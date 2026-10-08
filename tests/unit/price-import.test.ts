/**
 * Import des prix : tout ce qui précède l'écriture en base (choix des fichiers, téléchargement,
 * cache, lecture, garde « guide déjà importé »), avec un faux client Prisma minimal.
 * Le réseau est entièrement simulé (vi.spyOn(globalThis, "fetch")) : aucun accès réel.
 *
 * Également : alertes et journalisation (src/lib/monitoring.ts), utilisées par le cron.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, it, vi } from "vitest";
import { importPrices } from "../../src/lib/price-import";

const root = mkdtempSync(path.join(os.tmpdir(), "cptcg-price-unit-"));
let dirCount = 0;
const freshDir = () => path.join(root, `cache-${(dirCount += 1)}`);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const GUIDE_DATE = "2026-10-07T02:00:00+0200";
const PRODUCTS = JSON.stringify({
  version: 1,
  products: [{ idProduct: 1, name: "Test Card", categoryName: "Cyberpunk Single", idExpansion: 5 }],
});
const GUIDE = JSON.stringify({ version: 1, createdAt: GUIDE_DATE, priceGuides: [{ idProduct: 1, trend: 1.5 }] });
const NONSINGLES = JSON.stringify({ products: [{ idProduct: 2, name: "Box", idCategory: 1670 }] });

/**
 * Faux Prisma : seul priceSource.findUnique est disponible, avec un guide déjà importé dans le futur.
 * Tout import qui passe la lecture des fichiers s'arrête donc en « skipped », sans rien écrire.
 */
function fakePrisma(guideCreatedAt: Date | null = new Date("2100-01-01T00:00:00Z")) {
  const calls: string[] = [];
  const client = {
    priceSource: {
      findUnique: async () => {
        calls.push("priceSource.findUnique");
        return guideCreatedAt === undefined ? null : { guideCreatedAt };
      },
    },
  };
  return { prisma: client as unknown as PrismaClient, calls };
}

const quiet = () => undefined;

type Route = (url: string) => Response | Promise<Response>;
let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;
let fetched: string[] = [];

function mockFetch(route: Route) {
  fetched = [];
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    fetched.push(url);
    return route(url);
  });
}

/** Serveur Cardmarket simulé : `cyberpunkId` est le seul jeu Cyberpunk, les autres sont un autre jeu. */
function cardmarket(cyberpunkId: number, overrides: Partial<Record<"products" | "prices" | "nonsingles", Response>> = {}): Route {
  return (url) => {
    const id = Number(/_(\d+)\.json$/.exec(url)?.[1]);
    if (url.includes("/productList/products_singles_")) {
      if (id !== cyberpunkId) return new Response(JSON.stringify({ products: [{ idProduct: 9, name: "Pikachu" }] }));
      return overrides.products ?? new Response(PRODUCTS);
    }
    if (url.includes("/priceGuide/price_guide_")) return overrides.prices ?? new Response(GUIDE);
    if (url.includes("/productList/products_nonsingles_")) return overrides.nonsingles ?? new Response(NONSINGLES);
    return new Response("inconnu", { status: 404 });
  };
}

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

describe("import des prix : fichiers et garde-fous (sans base)", () => {
  it("hors ligne sans cache : erreur explicite, aucun téléchargement", async () => {
    mockFetch(() => new Response("", { status: 500 }));
    const { prisma, calls } = fakePrisma();
    const cacheDir = freshDir();
    await assert.rejects(importPrices(prisma, { cacheDir, offline: true, log: quiet }), /Aucun fichier Cardmarket en cache/);
    assert.equal(fetched.length, 0);
    assert.deepEqual(calls, []);
  });

  it("hors ligne : fichiers du cache (noms préférés), JSON gzip lisible", async () => {
    const cacheDir = mkdtempSync(path.join(root, "offline-"));
    writeFileSync(path.join(cacheDir, "products.json"), PRODUCTS);
    writeFileSync(path.join(cacheDir, "price_guide_23.json"), gzipSync(GUIDE));
    writeFileSync(path.join(cacheDir, "products_nonsingles_23.json"), NONSINGLES);
    const { prisma, calls } = fakePrisma();
    const result = await importPrices(prisma, { cacheDir, offline: true, log: quiet });
    assert.equal(result.status, "skipped");
    assert.deepEqual(calls, ["priceSource.findUnique"]);
  });

  it("hors ligne : plusieurs guides de prix en cache → erreur (pas de choix arbitraire)", async () => {
    const cacheDir = mkdtempSync(path.join(root, "offline-"));
    writeFileSync(path.join(cacheDir, "products_singles_23.json"), PRODUCTS);
    writeFileSync(path.join(cacheDir, "price_guide_23.json"), GUIDE);
    writeFileSync(path.join(cacheDir, "price_guide_24.json"), GUIDE);
    await assert.rejects(
      importPrices(fakePrisma().prisma, { cacheDir, offline: true, log: quiet }),
      /Plusieurs fichiers de guide de prix/,
    );
  });

  it("hors ligne : catalogue seul (sans guide) → pas de cache utilisable", async () => {
    const cacheDir = mkdtempSync(path.join(root, "offline-"));
    writeFileSync(path.join(cacheDir, "products_singles_23.json"), PRODUCTS);
    await assert.rejects(importPrices(fakePrisma().prisma, { cacheDir, offline: true, log: quiet }), /Aucun fichier/);
  });

  it("fichier manquant ou JSON invalide : « Lecture impossible », base intacte", async () => {
    const dir = mkdtempSync(path.join(root, "files-"));
    const products = path.join(dir, "p.json");
    const bad = path.join(dir, "bad.json");
    writeFileSync(products, PRODUCTS);
    writeFileSync(bad, "{ pas du json");
    const { prisma, calls } = fakePrisma();
    for (const files of [
      { products, prices: path.join(dir, "absent.json"), nonsingles: null },
      { products, prices: bad, nonsingles: null },
      { products: bad, prices: products, nonsingles: null },
      { products, prices: products, nonsingles: bad },
    ]) {
      await assert.rejects(importPrices(prisma, { cacheDir: dir, files, log: quiet }), /Lecture impossible/);
    }
    assert.deepEqual(calls, [], "aucune requête en base si les fichiers sont illisibles");
  });

  it("guide sans date : refusé sans --force", async () => {
    const dir = mkdtempSync(path.join(root, "files-"));
    const products = path.join(dir, "p.json");
    const prices = path.join(dir, "g.json");
    writeFileSync(products, PRODUCTS);
    writeFileSync(prices, JSON.stringify({ priceGuides: [{ idProduct: 1, trend: 1 }] }));
    const { prisma, calls } = fakePrisma();
    await assert.rejects(
      importPrices(prisma, { cacheDir: dir, files: { products, prices, nonsingles: null }, log: quiet }),
      /n'a pas de date/,
    );
    assert.deepEqual(calls, []);
  });

  it("guide identique ou plus ancien que le dernier importé : ignoré avec un message clair", async () => {
    const dir = mkdtempSync(path.join(root, "files-"));
    const products = path.join(dir, "p.json");
    const prices = path.join(dir, "g.json");
    writeFileSync(products, PRODUCTS);
    writeFileSync(prices, GUIDE);
    const files = { products, prices, nonsingles: null };
    const same = await importPrices(fakePrisma(new Date("2026-10-07T00:00:00Z")).prisma, { cacheDir: dir, files, log: quiet });
    assert.equal(same.status, "skipped");
    assert.match(same.status === "skipped" ? same.message : "", /déjà été importé/);
    const older = await importPrices(fakePrisma(new Date("2026-10-08T00:00:00Z")).prisma, { cacheDir: dir, files, log: quiet });
    assert.match(older.status === "skipped" ? older.message : "", /plus ancien que le dernier importé/);
  });
});

describe("import des prix : téléchargement Cardmarket simulé", () => {
  it("jeu 23 = Cyberpunk : 3 fichiers + game-id.txt dans le cache, en-têtes navigateur", async () => {
    mockFetch(cardmarket(23));
    const cacheDir = freshDir();
    const result = await importPrices(fakePrisma().prisma, { cacheDir, log: quiet });
    assert.equal(result.status, "skipped");
    assert.equal(readFileSync(path.join(cacheDir, "products_singles_23.json"), "utf8"), PRODUCTS);
    assert.equal(readFileSync(path.join(cacheDir, "price_guide_23.json"), "utf8"), GUIDE);
    assert.equal(readFileSync(path.join(cacheDir, "products_nonsingles_23.json"), "utf8"), NONSINGLES);
    assert.equal(readFileSync(path.join(cacheDir, "game-id.txt"), "utf8"), "23");
    assert.ok(fetched.every((url) => url.startsWith("https://downloads.s3.cardmarket.com/productCatalog/")));
    const init = fetchSpy?.mock.calls[0]?.[1] as RequestInit | undefined;
    assert.match(String((init?.headers as Record<string, string>)["user-agent"]), /Mozilla/);
  });

  it("jeu Cyberpunk ailleurs : recherche parmi les ids, puis id mémorisé pour la fois suivante", async () => {
    mockFetch(cardmarket(37));
    const cacheDir = freshDir();
    await importPrices(fakePrisma().prisma, { cacheDir, log: quiet });
    assert.equal(readFileSync(path.join(cacheDir, "game-id.txt"), "utf8"), "37");
    assert.ok(existsSync(path.join(cacheDir, "price_guide_37.json")));
    assert.match(fetched[0], /products_singles_23\.json$/, "l'id par défaut est essayé en premier");

    mockFetch(cardmarket(37));
    await importPrices(fakePrisma().prisma, { cacheDir, log: quiet });
    assert.match(fetched[0], /products_singles_37\.json$/, "l'id mémorisé est essayé en premier");
    assert.equal(fetched.filter((url) => url.includes("products_singles_")).length, 2, "une sonde + un téléchargement");
  });

  it("Cyberpunk introuvable : erreur après avoir sondé tous les ids", async () => {
    mockFetch(cardmarket(-1));
    await assert.rejects(importPrices(fakePrisma().prisma, { cacheDir: freshDir(), log: quiet }), /introuvable/);
    assert.equal(new Set(fetched).size, 40, "ids 1 à 40, chacun une seule fois");
  });

  for (const [label, response] of [
    ["403", () => new Response("Forbidden", { status: 403 })],
    ["503", () => new Response("Unavailable", { status: 503 })],
    ["page Cloudflare", () => new Response("<html><title>Just a moment...</title></html>")],
  ] as const) {
    it(`blocage (${label}) sans cache : message avec les URL à télécharger à la main`, async () => {
      mockFetch(() => response());
      await assert.rejects(
        importPrices(fakePrisma().prisma, { cacheDir: freshDir(), log: quiet }),
        (error: Error) => /refuse le téléchargement/.test(error.message) && /price_guide_23\.json/.test(error.message),
      );
      assert.equal(fetched.length, 1, "on s'arrête dès le premier blocage");
    });
  }

  it("blocage avec cache : utilise les fichiers en cache et le journalise", async () => {
    const cacheDir = mkdtempSync(path.join(root, "blocked-"));
    writeFileSync(path.join(cacheDir, "products_singles_23.json"), PRODUCTS);
    writeFileSync(path.join(cacheDir, "price_guide_23.json"), GUIDE);
    mockFetch(() => new Response("Forbidden", { status: 403 }));
    const logs: string[] = [];
    const result = await importPrices(fakePrisma().prisma, { cacheDir, log: (line) => logs.push(line) });
    assert.equal(result.status, "skipped");
    assert.equal(logs.length, 1);
    assert.match(logs[0], /^Téléchargement impossible [\s\S]*Utilisation des fichiers en cache\.$/);
  });

  it("guide remplacé par une page HTML : erreur, pas de guide corrompu en cache", async () => {
    const cacheDir = freshDir();
    mockFetch(cardmarket(23, { prices: new Response("<!DOCTYPE html><html>captcha</html>") }));
    await assert.rejects(importPrices(fakePrisma().prisma, { cacheDir, log: quiet }), /renvoyé une page/);
    assert.equal(existsSync(path.join(cacheDir, "price_guide_23.json")), false);
  });

  it("téléchargement HTTP en échec : erreur avec le statut", async () => {
    mockFetch(cardmarket(23, { prices: new Response("", { status: 500 }) }));
    await assert.rejects(importPrices(fakePrisma().prisma, { cacheDir: freshDir(), log: quiet }), /^Error: 500 https:/);
  });

  // Régression : products_nonsingles est optionnel, mais resolveFiles renvoyait toujours son chemin ;
  // sans copie en cache, tout l'import (donc le cron) tombait en « Lecture impossible ».
  it("échec du téléchargement des produits scellés sans cache : import poursuivi sans eux", async () => {
    mockFetch(cardmarket(23, { nonsingles: new Response("", { status: 404 }) }));
    const result = await importPrices(fakePrisma().prisma, { cacheDir: freshDir(), log: quiet });
    assert.equal(result.status, "skipped");
  });
});

describe("monitoring : alertes et journalisation", () => {
  type Monitoring = typeof import("../../src/lib/monitoring");
  const savedEnv = { url: process.env.ALERT_WEBHOOK_URL, vercel: process.env.VERCEL_ENV };
  let monitoring: Monitoring;
  let errors: string[];
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Module rechargé : la table anti-doublons repart de zéro à chaque test.
    vi.resetModules();
    monitoring = await import("../../src/lib/monitoring");
    errors = [];
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.com/hook";
    process.env.VERCEL_ENV = "test-env";
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.restoreAllMocks();
    for (const [key, value] of [
      ["ALERT_WEBHOOK_URL", savedEnv.url],
      ["VERCEL_ENV", savedEnv.vercel],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("sans webhook (absent ou blanc) : rien n'est envoyé", async () => {
    mockFetch(() => new Response("ok"));
    delete process.env.ALERT_WEBHOOK_URL;
    assert.equal(await monitoring.sendAlert("a"), false);
    process.env.ALERT_WEBHOOK_URL = "   ";
    assert.equal(await monitoring.sendAlert("b"), false);
    assert.equal(fetched.length, 0);
  });

  it("POST JSON compatible Discord et Slack, préfixé par l'environnement, tronqué à 1900", async () => {
    mockFetch(() => new Response("ok"));
    assert.equal(await monitoring.sendAlert("x".repeat(3000)), true);
    assert.deepEqual(fetched, ["https://alerts.example.com/hook"]);
    const init = fetchSpy?.mock.calls[0]?.[1] as RequestInit;
    assert.equal(init.method, "POST");
    const body = JSON.parse(String(init.body)) as { content: string; text: string };
    assert.equal(body.content, body.text);
    assert.ok(body.content.startsWith("[cybertpunktcg · test-env] xxx"));
    assert.equal(body.content.length, 1900);
  });

  it("même message répété : envoyé une fois par 10 minutes", async () => {
    mockFetch(() => new Response("ok"));
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    assert.equal(await monitoring.sendAlert("panne"), true);
    assert.equal(await monitoring.sendAlert("panne"), false);
    assert.equal(await monitoring.sendAlert("autre panne"), true);
    clock.mockReturnValue(now + 9 * 60_000);
    assert.equal(await monitoring.sendAlert("panne"), false);
    clock.mockReturnValue(now + 10 * 60_000 + 1);
    assert.equal(await monitoring.sendAlert("panne"), true);
    assert.equal(fetched.length, 3);
  });

  it("webhook en erreur ou injoignable : false, journalisé, jamais d'exception", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    assert.equal(await monitoring.sendAlert("statut 500"), false);
    fetchSpy?.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });
    assert.equal(await monitoring.sendAlert("réseau"), false);
    assert.ok(errors.some((line) => /Envoi de l'alerte impossible : ECONNREFUSED/.test(line)));
  });

  it("reportError : log JSON structuré + alerte « Erreur <source> : <message> »", async () => {
    mockFetch(() => new Response("ok"));
    await monitoring.reportError("import-prices", new Error("boom"), { consecutiveFailures: 2 });
    assert.deepEqual(JSON.parse(errors[0]), {
      level: "error",
      source: "import-prices",
      message: "boom",
      consecutiveFailures: 2,
    });
    const body = JSON.parse(String((fetchSpy?.mock.calls[0]?.[1] as RequestInit).body)) as { text: string };
    assert.match(body.text, /Erreur import-prices : boom$/);
    await monitoring.reportError("s", "texte brut");
    await monitoring.reportError("s", { code: 42 });
    assert.equal(JSON.parse(errors[1]).message, "texte brut");
    assert.equal(JSON.parse(errors[2]).message, '{"code":42}');
  });

  // Régression : describe() faisait JSON.stringify(error) sans garde ; un objet circulaire (ou un
  // BigInt) faisait lever reportError, alors que le module promet de ne jamais lever.
  it("reportError ne lève pas sur une erreur non sérialisable", async () => {
    mockFetch(() => new Response("ok"));
    const circular: Record<string, unknown> = { name: "circulaire" };
    circular.self = circular;
    await monitoring.reportError("s", circular);
  });
});
