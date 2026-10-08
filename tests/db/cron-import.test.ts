/**
 * Cron d'import des prix (src/app/api/cron/import-prices/route.ts) et suivi des tâches
 * (src/lib/job-status.ts). Travaille sur une COPIE de la base (tests/helpers/db-copy.ts).
 *
 * Aucun import réel : importPrices est simulé (vi.mock), revalidateTag aussi (hors requête Next),
 * et le webhook d'alerte est intercepté (vi.spyOn(globalThis, "fetch")) : aucun accès réseau.
 */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";

const mocks = vi.hoisted(() => ({
  importPrices: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/price-import", () => ({ importPrices: mocks.importPrices }));
vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: <T>(fn: T) => fn,
}));

type Prisma = typeof import("../../src/lib/prisma").prisma;
type JobStatusModule = typeof import("../../src/lib/job-status");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SECRET = `cron-secret-${stamp}`;
const JOB = "import-prices";
const savedEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
};

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let GET: typeof import("../../src/app/api/cron/import-prices/route").GET;
let jobStatus: JobStatusModule;
let alerts: string[] = [];
let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];
const rateLimitKeys = [`cron-test-expired-${stamp}`, `cron-test-live-${stamp}`];

const call = (authorization?: string) =>
  GET(
    new Request("http://127.0.0.1/api/cron/import-prices", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

const jobRow = () => prisma.jobStatus.findUnique({ where: { name: JOB } });

function restoreEnv(key: keyof typeof savedEnv) {
  if (savedEnv[key] === undefined) delete process.env[key];
  else process.env[key] = savedEnv[key];
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-cron-");
  prisma = db.prisma;
  ({ GET } = await import("../../src/app/api/cron/import-prices/route"));
  jobStatus = await import("../../src/lib/job-status");
  // Copie seulement : état du cron et du guide repartis de zéro.
  await prisma.jobStatus.deleteMany({});
  await prisma.priceSource.upsert({
    where: { code: "cardmarket" },
    update: { guideCreatedAt: null },
    create: { code: "cardmarket", name: "Cardmarket" },
  });
});

afterAll(async () => {
  try {
    if (prisma) {
      await prisma.rateLimit.deleteMany({ where: { key: { in: rateLimitKeys } } });
      await prisma.jobStatus.deleteMany({ where: { name: { in: [JOB, `test-job-${stamp}`] } } });
    }
  } finally {
    restoreEnv("CRON_SECRET");
    restoreEnv("ALERT_WEBHOOK_URL");
    await db?.cleanup();
  }
});

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  process.env.ALERT_WEBHOOK_URL = "https://alerts.example.com/hook";
  mocks.importPrices.mockReset();
  mocks.revalidateTag.mockReset();
  alerts = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    assert.equal(String(input), "https://alerts.example.com/hook", "seul le webhook d'alerte peut être appelé");
    alerts.push((JSON.parse(String(init?.body)) as { text: string }).text);
    return new Response("ok");
  });
  consoleSpies = [vi.spyOn(console, "log").mockImplementation(() => undefined), vi.spyOn(console, "error").mockImplementation(() => undefined)];
});

afterEach(() => {
  vi.restoreAllMocks();
  consoleSpies = [];
});

describe.sequential("cron import-prices : authentification", () => {
  it("CRON_SECRET absent ou blanc : toujours refusé, même avec « Bearer » vide", async () => {
    delete process.env.CRON_SECRET;
    for (const header of [undefined, "", "Bearer ", "Bearer undefined"]) {
      assert.equal((await call(header)).status, 401, `en-tête ${JSON.stringify(header)}`);
    }
    process.env.CRON_SECRET = "   ";
    for (const header of ["Bearer ", "Bearer    ", "Bearer"]) {
      assert.equal((await call(header)).status, 401, `secret blanc, en-tête ${JSON.stringify(header)}`);
    }
    assert.equal(mocks.importPrices.mock.calls.length, 0);
  });

  it("en-tête absent ou faux : 401 sans rien lancer ni enregistrer", async () => {
    const wrongSameLength = `Bearer ${"x".repeat(SECRET.length)}`;
    for (const header of [
      undefined,
      SECRET,
      `bearer ${SECRET}`,
      `Bearer ${SECRET.slice(0, -1)}`,
      wrongSameLength,
      `Basic ${SECRET}`,
    ]) {
      const response = await call(header);
      assert.equal(response.status, 401, `en-tête ${JSON.stringify(header)}`);
      assert.deepEqual(await response.json(), { error: "Non autorisé." });
    }
    assert.equal(mocks.importPrices.mock.calls.length, 0);
    assert.equal(await jobRow(), null, "un appel refusé ne doit pas toucher au statut du job");
  });

  it("secret avec espaces autour dans l'environnement : comparé une fois nettoyé", async () => {
    process.env.CRON_SECRET = `  ${SECRET}\n`;
    mocks.importPrices.mockResolvedValue({ status: "skipped", message: "déjà importé" });
    assert.equal((await call(`Bearer ${SECRET}`)).status, 200);
  });
});

describe.sequential("cron import-prices : exécution et statut du job", () => {
  it("succès : import lancé sur /tmp/cardmarket, cache catalogue invalidé, statut à jour", async () => {
    const result = { status: "imported", report: { printingsPriced: 3 } };
    mocks.importPrices.mockResolvedValue(result);
    const response = await call(`Bearer ${SECRET}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result);
    assert.equal(mocks.importPrices.mock.calls.length, 1);
    const [client, options] = mocks.importPrices.mock.calls[0] as [unknown, { cacheDir: string }];
    assert.equal(client, prisma, "le cron doit utiliser le client Prisma partagé");
    assert.equal(options.cacheDir, path.join(tmpdir(), "cardmarket"));
    assert.deepEqual(mocks.revalidateTag.mock.calls, [["catalog", "max"]]);
    const row = await jobRow();
    assert.ok(row?.lastSuccessAt);
    assert.equal(row.consecutiveFailures, 0);
    assert.equal(row.lastError, null);
    assert.deepEqual(alerts, [], "aucune alerte sur un succès simple");
  });

  it("guide déjà importé (skipped) : 200, pas d'invalidation du cache", async () => {
    mocks.importPrices.mockResolvedValue({ status: "skipped", message: "déjà importé" });
    const response = await call(`Bearer ${SECRET}`);
    assert.equal(response.status, 200);
    assert.equal(mocks.revalidateTag.mock.calls.length, 0);
    assert.equal((await jobRow())?.consecutiveFailures, 0);
  });

  it("échecs successifs : 500, compteur incrémenté, dernier succès conservé, alertes", async () => {
    const lastSuccessAt = (await jobRow())?.lastSuccessAt?.toISOString();
    assert.ok(lastSuccessAt);

    mocks.importPrices.mockRejectedValue(new Error(`Cardmarket injoignable ${stamp}`));
    const first = await call(`Bearer ${SECRET}`);
    assert.equal(first.status, 500);
    assert.deepEqual(await first.json(), { status: "error", message: `Cardmarket injoignable ${stamp}` });
    let row = await jobRow();
    assert.equal(row?.consecutiveFailures, 1);
    assert.equal(row?.lastError, `Cardmarket injoignable ${stamp}`);
    assert.equal(row?.lastSuccessAt?.toISOString(), lastSuccessAt);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], new RegExp(`Erreur import-prices : Cardmarket injoignable ${stamp}$`));
    assert.equal(mocks.revalidateTag.mock.calls.length, 0);

    // Rejet qui n'est pas une Error : message conservé tel quel.
    mocks.importPrices.mockRejectedValue(`panne texte ${stamp}`);
    const second = await call(`Bearer ${SECRET}`);
    assert.equal(second.status, 500);
    assert.equal(((await second.json()) as { message: string }).message, `panne texte ${stamp}`);
    row = await jobRow();
    assert.equal(row?.consecutiveFailures, 2);
    assert.ok(
      alerts.some((text) => text.endsWith(`import-prices : 2 échecs consécutifs. Dernier succès : ${lastSuccessAt}.`)),
      `alerte d'échecs consécutifs absente : ${alerts.join(" | ")}`,
    );
  });

  it("retour au succès : compteur remis à zéro, erreur effacée, alerte de rétablissement", async () => {
    mocks.importPrices.mockResolvedValue({ status: "imported", report: {} });
    assert.equal((await call(`Bearer ${SECRET}`)).status, 200);
    const row = await jobRow();
    assert.equal(row?.consecutiveFailures, 0);
    assert.equal(row?.lastError, null);
    assert.ok(alerts.some((text) => text.endsWith("import-prices rétabli après 2 échec(s).")), alerts.join(" | "));
  });

  it("purge des limites de débit expirées avant l'import, les autres gardées", async () => {
    await prisma.rateLimit.createMany({
      data: [
        { key: rateLimitKeys[0], count: 1, resetAt: new Date(Date.now() - 60_000) },
        { key: rateLimitKeys[1], count: 1, resetAt: new Date(Date.now() + 3_600_000) },
      ],
    });
    mocks.importPrices.mockResolvedValue({ status: "skipped", message: "" });
    assert.equal((await call(`Bearer ${SECRET}`)).status, 200);
    const left = await prisma.rateLimit.findMany({ where: { key: { in: rateLimitKeys } } });
    assert.deepEqual(left.map((row) => row.key), [rateLimitKeys[1]]);
  });

  it("guide de prix trop ancien après un import réussi : alerte de fraîcheur", async () => {
    await prisma.priceSource.update({
      where: { code: "cardmarket" },
      data: { guideCreatedAt: new Date(Date.now() - 5 * 86_400_000 - 60_000) },
    });
    mocks.importPrices.mockResolvedValue({ status: "skipped", message: "" });
    assert.equal((await call(`Bearer ${SECRET}`)).status, 200);
    assert.ok(alerts.some((text) => /Prix Cardmarket non mis à jour depuis 5 jours/.test(text)), alerts.join(" | "));
  });
});

describe.sequential("job-status", () => {
  const name = `test-job-${stamp}`;

  it("premier échec sans historique : ligne créée, une seule alerte (erreur)", async () => {
    await jobStatus.recordJobFailure(name, new Error("e1"));
    const row = await prisma.jobStatus.findUniqueOrThrow({ where: { name } });
    assert.equal(row.consecutiveFailures, 1);
    assert.equal(row.lastSuccessAt, null);
    assert.equal(row.lastError, "e1");
    assert.equal(alerts.length, 1);
    await jobStatus.recordJobFailure(name, new Error("e2"));
    assert.ok(alerts.some((text) => text.endsWith(`${name} : 2 échecs consécutifs.`)), "sans succès : pas de date");
  });

  it("succès : remise à zéro et alerte de rétablissement ; succès suivant sans alerte", async () => {
    await jobStatus.recordJobSuccess(name);
    assert.ok(alerts.some((text) => text.endsWith(`${name} rétabli après 2 échec(s).`)));
    alerts = [];
    await jobStatus.recordJobSuccess(name);
    assert.deepEqual(alerts, []);
    const row = await prisma.jobStatus.findUniqueOrThrow({ where: { name } });
    assert.equal(row.consecutiveFailures, 0);
    assert.equal(row.lastError, null);
  });

  it("base indisponible pendant l'enregistrement d'un échec : l'erreur est quand même signalée", async () => {
    vi.spyOn(prisma.jobStatus, "upsert").mockRejectedValue(new Error("db down"));
    await jobStatus.recordJobFailure(name, new Error(`e3 ${stamp}`));
    assert.ok(alerts.some((text) => text.endsWith(`Erreur ${name} : e3 ${stamp}`)));
    const errorSpy = consoleSpies[1];
    assert.ok(errorSpy.mock.calls.some((args: unknown[]) => String(args[0]).includes("non enregistré : db down")));
  });

  it("fraîcheur du guide : null sans guide, âge en jours, alerte à partir de 3 jours", async () => {
    await prisma.priceSource.update({ where: { code: "cardmarket" }, data: { guideCreatedAt: null } });
    assert.equal(await jobStatus.checkPriceGuideFreshness(), null);
    await prisma.priceSource.update({
      where: { code: "cardmarket" },
      data: { guideCreatedAt: new Date(Date.now() - 2 * 86_400_000 - 60_000) },
    });
    assert.equal(await jobStatus.checkPriceGuideFreshness(), 2);
    assert.deepEqual(alerts, []);
    const old = new Date(Date.now() - 3 * 86_400_000 - 60_000);
    await prisma.priceSource.update({ where: { code: "cardmarket" }, data: { guideCreatedAt: old } });
    assert.equal(await jobStatus.checkPriceGuideFreshness(), 3);
    assert.deepEqual(alerts, [
      `[cybertpunktcg · ${process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local"}] Prix Cardmarket non mis à jour depuis 3 jours (guide du ${old.toISOString().slice(0, 10)}).`,
    ]);
  });
});
