/**
 * Limiteur de débit stocké en base (RateLimit).
 * Travaille sur une COPIE de la base SQLite : purgeExpiredRateLimits supprime tous les
 * compteurs expirés, y compris ceux qui ne viennent pas du test.
 */
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { pushSchema, sqliteFile } from "../helpers/sqlite";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Limiter = typeof import("../../src/lib/rate-limit");

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "cptcg-ratelimit-"));
const dbFile = path.join(tmpDir, "test.db");
const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const key = (name: string) => `test-${stamp}-${name}`;

let prisma: Prisma;
let limiter: Limiter;

const counter = (name: string) => prisma.rateLimit.findUnique({ where: { key: key(name) } });

beforeAll(async () => {
  copyFileSync(sqliteFile(process.env.DATABASE_URL ?? ""), dbFile);
  process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, "/")}`;
  pushSchema(process.env.DATABASE_URL);

  // Imports après DATABASE_URL : le client Prisma doit pointer vers la copie.
  delete (globalThis as { prisma?: unknown }).prisma;
  ({ prisma } = await import("../../src/lib/prisma"));
  const databases = await prisma.$queryRawUnsafe<{ file: string }[]>("PRAGMA database_list");
  assert.equal(
    path.resolve(databases[0]?.file ?? ""),
    path.resolve(dbFile),
    "le client Prisma doit pointer vers la copie, jamais vers la vraie base",
  );
  limiter = await import("../../src/lib/rate-limit");
});

afterAll(async () => {
  // Rien n'est écrit dans la vraie base ; on nettoie quand même la copie avant de la supprimer.
  await prisma?.rateLimit.deleteMany({ where: { key: { startsWith: `test-${stamp}-` } } }).catch(() => undefined);
  await prisma?.$disconnect();
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Windows peut garder le fichier verrouillé quelques instants.
  }
});

describe.sequential("fenêtre fixe", () => {
  it("limite exacte : la N-ième requête passe, la N+1-ième est refusée", async () => {
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await limiter.rateLimit(key("exact"), 3, 60_000));
    assert.deepEqual(
      results.map((result) => [result.ok, result.remaining]),
      [
        [true, 2],
        [true, 1],
        [true, 0],
        [false, 0],
        [false, 0],
      ],
    );
    for (const refused of results.slice(3)) {
      assert.ok(refused.retryAfterMs > 0 && refused.retryAfterMs <= 60_000, `retryAfterMs=${refused.retryAfterMs}`);
    }
    for (const accepted of results.slice(0, 3)) assert.equal(accepted.retryAfterMs, 0);
    assert.equal((await counter("exact"))?.count, 5, "chaque tentative est comptée");
  });

  it("limite 1 : seule la première passe", async () => {
    assert.equal((await limiter.rateLimit(key("one"), 1, 60_000)).ok, true);
    assert.equal((await limiter.rateLimit(key("one"), 1, 60_000)).ok, false);
  });

  it("fenêtre expirée : le compteur repart à 1", async () => {
    for (let i = 0; i < 3; i += 1) await limiter.rateLimit(key("expire"), 2, 60_000);
    assert.equal((await limiter.rateLimit(key("expire"), 2, 60_000)).ok, false);
    await prisma.rateLimit.update({ where: { key: key("expire") }, data: { resetAt: new Date(Date.now() - 1) } });

    const reset = await limiter.rateLimit(key("expire"), 2, 60_000);
    assert.deepEqual(reset, { ok: true, remaining: 1, retryAfterMs: 0 });
    const row = await counter("expire");
    assert.equal(row?.count, 1, "nouvelle fenêtre : compteur à 1");
    assert.ok(row && row.resetAt.getTime() > Date.now() + 50_000, "nouvelle échéance dans la fenêtre");
    assert.deepEqual(await limiter.rateLimit(key("expire"), 2, 60_000), { ok: true, remaining: 0, retryAfterMs: 0 });
    assert.equal((await limiter.rateLimit(key("expire"), 2, 60_000)).ok, false);
  });

  it("fenêtre courte réelle : bloqué puis libéré après l'échéance", async () => {
    assert.equal((await limiter.rateLimit(key("short"), 1, 150)).ok, true);
    assert.equal((await limiter.rateLimit(key("short"), 1, 150)).ok, false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal((await limiter.rateLimit(key("short"), 1, 150)).ok, true);
  });

  it("les clés sont isolées", async () => {
    for (let i = 0; i < 3; i += 1) await limiter.rateLimit(key("iso-a"), 2, 60_000);
    assert.equal((await limiter.rateLimit(key("iso-a"), 2, 60_000)).ok, false);
    assert.deepEqual(await limiter.rateLimit(key("iso-b"), 2, 60_000), { ok: true, remaining: 1, retryAfterMs: 0 });
    assert.equal((await counter("iso-b"))?.count, 1);
  });

  it("requêtes simultanées : exactement la limite passe", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => limiter.rateLimit(key("concurrent"), 5, 60_000)),
    );
    assert.equal(results.filter((result) => result.ok).length, 5);
    assert.equal((await counter("concurrent"))?.count, 12);
  });

  // Rafale lancée pile à l'expiration : l'entrelacement le plus défavorable est rendu
  // déterministe en retardant la remise à zéro jusqu'à ce que tous les upserts soient faits.
  it("rafale simultanée juste après l'expiration : la limite tient", async () => {
    await prisma.rateLimit.create({ data: { key: key("burst"), count: 99, resetAt: new Date(Date.now() - 1) } });
    const total = 12;
    let upserts = 0;
    let release: () => void = () => undefined;
    const allUpserted = new Promise<void>((resolve) => (release = resolve));
    // Filet de sécurité : jamais d'attente infinie si un upsert échoue.
    const guard = setTimeout(() => release(), 5_000);
    const delegate = prisma.rateLimit;
    const originalUpsert = delegate.upsert.bind(delegate) as (args: unknown) => Promise<unknown>;
    const originalUpdateMany = delegate.updateMany.bind(delegate) as (args: unknown) => Promise<unknown>;
    const upsert = vi.spyOn(delegate, "upsert").mockImplementation(((args: unknown) =>
      originalUpsert(args).then((row) => {
        upserts += 1;
        if (upserts === total) release();
        return row;
      })) as never);
    const updateMany = vi
      .spyOn(delegate, "updateMany")
      .mockImplementation(((args: unknown) => allUpserted.then(() => originalUpdateMany(args))) as never);
    try {
      const results = await Promise.all(Array.from({ length: total }, () => limiter.rateLimit(key("burst"), 5, 60_000)));
      const accepted = results.filter((result) => result.ok).length;
      assert.ok(accepted <= 5, `${accepted} requêtes acceptées pour une limite de 5`);
    } finally {
      clearTimeout(guard);
      upsert.mockRestore();
      updateMany.mockRestore();
    }
  });
});

describe.sequential("purge des compteurs", () => {
  it("ne supprime que les compteurs expirés", async () => {
    await prisma.rateLimit.createMany({
      data: [
        { key: key("purge-old"), count: 4, resetAt: new Date(Date.now() - 60_000) },
        { key: key("purge-live"), count: 2, resetAt: new Date(Date.now() + 60_000) },
      ],
    });
    const purged = await limiter.purgeExpiredRateLimits();
    assert.ok(purged >= 1, `au moins le compteur expiré du test (${purged})`);
    assert.equal(await counter("purge-old"), null);
    assert.equal((await counter("purge-live"))?.count, 2, "un compteur actif reste");
    assert.equal(await prisma.rateLimit.count({ where: { resetAt: { lt: new Date() } } }), 0);
    assert.equal(await limiter.purgeExpiredRateLimits(), 0, "seconde purge sans effet");
  });
});

describe("clé client", () => {
  function withEnv(values: Record<string, string | undefined>, run: () => void) {
    const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
    const apply = (entries: Record<string, string | undefined>) => {
      for (const [name, value] of Object.entries(entries)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    };
    apply(values);
    try {
      run();
    } finally {
      apply(previous);
    }
  }
  const req = (headers: Record<string, string>) => new Request("http://127.0.0.1/", { headers });

  it("sans proxy de confiance, les en-têtes d'IP sont ignorés", () => {
    withEnv({ TRUST_PROXY: undefined, VERCEL: undefined }, () => {
      assert.equal(limiter.clientKey(req({ "x-forwarded-for": "203.0.113.9" }), "login"), "login:local");
      assert.equal(limiter.clientKey(req({ "x-real-ip": "203.0.113.9" }), "login"), "login:local");
    });
  });

  it("derrière un proxy : x-real-ip prioritaire, sinon la première IP de x-forwarded-for", () => {
    withEnv({ TRUST_PROXY: "1" }, () => {
      assert.equal(
        limiter.clientKey(req({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "203.0.113.9" }), "login"),
        "login:198.51.100.1",
      );
      assert.equal(limiter.clientKey(req({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" }), "register"), "register:203.0.113.9");
      assert.equal(limiter.clientKey(req({}), "login"), "login:local");
    });
  });
});

describe("panne de la base", () => {
  it("laisse passer et signale l'erreur (fail-open)", async () => {
    const previousWebhook = process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_WEBHOOK_URL;
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      // Copie seulement : la table disparaît pour simuler une panne.
      await prisma.$executeRawUnsafe("DROP TABLE RateLimit");
      const result = await limiter.rateLimit(key("down"), 1, 60_000);
      assert.deepEqual(result, { ok: true, remaining: 1, retryAfterMs: 0 });
      assert.ok(errors.some((entry) => String(entry).includes("rate-limit")), "l'erreur est journalisée");
    } finally {
      console.error = original;
      if (previousWebhook !== undefined) process.env.ALERT_WEBHOOK_URL = previousWebhook;
    }
  });
});
