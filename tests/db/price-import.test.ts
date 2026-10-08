/**
 * Import du guide de prix Cardmarket (src/lib/price-import.ts) écrit en base.
 * Travaille sur une COPIE de la base SQLite de DATABASE_URL (tests/helpers/db-copy.ts) :
 * la vraie base n'est jamais modifiée. Dans la copie, tout le catalogue existant est désactivé
 * et les prix Cardmarket vidés, puis un mini-catalogue propre au test est créé : le test marche
 * donc aussi bien avec le vrai catalogue qu'avec la base CI.
 *
 * Les fichiers Cardmarket sont des fixtures écrites dans un dossier temporaire (`files`) :
 * aucun accès réseau. « Le lendemain » est simulé en reculant d'un jour les snapshots existants.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type PriceImport = typeof import("../../src/lib/price-import");
type PriceHistory = typeof import("../../src/lib/price-history");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SET_NAME = `Price Import Fixture ${stamp}`;
const SET_CODE = `pi-fixture-${stamp}`;
const NAMES = ["Fixture Alpha", "Fixture Bravo", "Fixture Charlie", "Fixture Delta"];
const BASE_ID = 880_000_000;
const UNKNOWN_ID = BASE_ID + 99;
const BOX_ID = BASE_ID + 500;
const LOT_ID = BASE_ID + 501;
const SEALED_PREFIX = `cardmarket:${String(BOX_ID).slice(0, -2)}`; // cardmarket:8800005xx

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let importPrices: PriceImport["importPrices"];
let ph: PriceHistory;
let filesDir: string;
let sourceId: string;
let userId: string;
/** P[0..3] : impressions du mini-catalogue, produits BASE_ID + 1..4. */
let P: string[] = [];

let guideClock = Date.parse("2026-01-01T00:00:00Z");
/** Chaque import reçoit un guide plus récent que le précédent (sauf date explicite). */
const nextGuideDate = () => new Date((guideClock += 3_600_000)).toISOString();

type Trends = Record<number, number>;
let fileCount = 0;

async function runImport(
  trends: Trends,
  options: { createdAt?: string | null; force?: boolean; nonsingles?: unknown; gzip?: boolean } = {},
) {
  fileCount += 1;
  const products = path.join(filesDir, `products-${fileCount}.json`);
  const prices = path.join(filesDir, `guide-${fileCount}.json`);
  writeFileSync(
    products,
    JSON.stringify({
      version: 1,
      products: [
        ...NAMES.map((name, index) => ({
          idProduct: BASE_ID + index + 1,
          name,
          expansionName: SET_NAME,
          number: String(index + 1).padStart(3, "0"),
        })),
        { idProduct: UNKNOWN_ID, name: "Mystery Card", expansionName: `Unknown Expansion ${stamp}` },
      ],
    }),
  );
  const createdAt = options.createdAt === undefined ? nextGuideDate() : options.createdAt;
  const guide = JSON.stringify({
    version: 1,
    ...(createdAt ? { createdAt } : {}),
    priceGuides: Object.entries(trends).map(([id, amount]) => ({ idProduct: Number(id), trend: amount, low: 0, avg: 0 })),
  });
  writeFileSync(prices, options.gzip ? gzipSync(guide) : guide);
  let nonsingles: string | null = null;
  if (options.nonsingles) {
    nonsingles = path.join(filesDir, `nonsingles-${fileCount}.json`);
    writeFileSync(nonsingles, JSON.stringify(options.nonsingles));
  }
  return importPrices(prisma, {
    cacheDir: filesDir,
    files: { products, prices, nonsingles },
    force: options.force,
    log: () => undefined,
  });
}

async function imported(trends: Trends, options?: Parameters<typeof runImport>[1]) {
  const result = await runImport(trends, options);
  assert.equal(result.status, "imported", result.status === "skipped" ? result.message : "");
  return (result as { report: Record<string, unknown> }).report;
}

const trend = (amounts: (number | undefined)[]): Trends =>
  Object.fromEntries(
    amounts.flatMap((amount, index) => (amount === undefined ? [] : [[BASE_ID + index + 1, amount]])),
  );

const dayKey = (ago: number) => ph.utcDayKey(ph.shiftUtcDay(ph.utcDay(), -ago));

/** Prix courant de chaque impression suivie : [montant, montant précédent] ou null. */
async function priceState(ids: string[] = P) {
  const rows = await prisma.price.findMany({ where: { printingId: { in: ids } } });
  return ids.map((id) => {
    const row = rows.filter((price) => price.printingId === id);
    assert.ok(row.length <= 1, "une seule ligne de prix par impression");
    if (row.length === 0) return null;
    assert.equal(row[0].sourceId, sourceId);
    assert.equal(row[0].kind, "trend");
    assert.equal(row[0].currency, "EUR");
    return [Number(row[0].amount), row[0].previousAmount == null ? null : Number(row[0].previousAmount)];
  });
}

/** Historique d'une impression : { "AAAA-MM-JJ": montant }. */
async function history(printingId: string) {
  const rows = await prisma.priceSnapshot.findMany({ where: { printingId }, orderBy: { day: "asc" } });
  return Object.fromEntries(rows.map((row) => [ph.utcDayKey(row.day), Number(row.amount)]));
}

const histories = async () => Promise.all(P.map(history));

/** « Les jours passent » : tous les snapshots reculent de `days` jours. */
async function shiftDays(days: number) {
  const rows = await prisma.priceSnapshot.findMany({ orderBy: { day: "asc" }, select: { id: true, day: true } });
  for (const row of rows) {
    await prisma.priceSnapshot.update({ where: { id: row.id }, data: { day: ph.shiftUtcDay(row.day, -days) } });
  }
}

async function seedHistoryCache() {
  await prisma.portfolioHistoryCache.upsert({
    where: { userId_scope: { userId, scope: "*|*" } },
    create: { userId, scope: "*|*", fingerprint: "f", lastDay: null, lastPricesJson: "{}", pointsJson: "[]" },
    update: {},
  });
}

const guideCreatedAt = async () =>
  (await prisma.priceSource.findUniqueOrThrow({ where: { code: "cardmarket" } })).guideCreatedAt?.toISOString() ?? null;

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-price-import-");
  prisma = db.prisma;
  filesDir = mkdtempSync(path.join(db.tmpDir, "files-"));
  ({ importPrices } = await import("../../src/lib/price-import"));
  ph = await import("../../src/lib/price-history");

  // Copie seulement : catalogue existant hors jeu, prix Cardmarket repartis de zéro.
  await prisma.printing.updateMany({ data: { isActive: false } });
  await prisma.priceSnapshot.deleteMany({});
  await prisma.price.deleteMany({});
  await prisma.portfolioHistoryCache.deleteMany({});
  sourceId = (
    await prisma.priceSource.upsert({
      where: { code: "cardmarket" },
      update: { guideCreatedAt: null },
      create: { code: "cardmarket", name: "Cardmarket" },
    })
  ).id;

  const set = await prisma.set.create({ data: { code: SET_CODE, name: SET_NAME, cardCount: NAMES.length } });
  for (const [index, name] of NAMES.entries()) {
    const id = `pi-${stamp}-${index + 1}`;
    const card = await prisma.card.create({
      data: { externalId: id, code: id, slug: id, name, displayName: name, canonicalName: name },
    });
    const printing = await prisma.printing.create({
      data: {
        externalId: `${id}-p`,
        cardId: card.id,
        setId: set.id,
        collectorNumber: String(index + 1).padStart(3, "0"),
        language: "en",
      },
    });
    P.push(printing.id);
  }
  userId = (await prisma.user.create({ data: { id: `pi-user-${stamp}`, email: `pi.${stamp}@example.com` } })).id;
});

afterAll(async () => {
  try {
    // Tout est dans la copie, supprimée ci-dessous ; on nettoie quand même ce qui a été créé.
    if (prisma && userId) await prisma.user.deleteMany({ where: { id: userId } });
  } finally {
    await db?.cleanup();
    P = [];
  }
});

describe.sequential("import des prix Cardmarket en base (copie)", () => {
  it("premier import : prix créés, snapshot du jour, prix à 0 et produit inconnu ignorés", async () => {
    const report = await imported({ ...trend([1, 2, 3, 0]), [UNKNOWN_ID]: 5 });
    assert.deepEqual(await priceState(), [[1, null], [2, null], [3, null], null]);
    assert.deepEqual(await histories(), [
      { [dayKey(0)]: 1 },
      { [dayKey(0)]: 2 },
      { [dayKey(0)]: 3 },
      {},
    ]);
    assert.equal(report.printingsPriced, 3);
    assert.equal(report.snapshotsWritten, 3);
    assert.equal(report.baselinesWritten, 0);
    assert.equal(report.snapshotDay, dayKey(0));
    assert.deepEqual(report.unknownExpansions, [`Unknown Expansion ${stamp}`]);
    assert.equal(report.unknownExpansion, 1);
    assert.equal(await guideCreatedAt(), report.guideCreatedAt);
  });

  it("même guide relancé : ignoré, rien ne change", async () => {
    const before = { prices: await priceState(), history: await histories(), guide: await guideCreatedAt() };
    const same = await runImport(trend([9, 9, 9, 9]), { createdAt: before.guide });
    assert.equal(same.status, "skipped");
    assert.match((same as { message: string }).message, /déjà été importé/);
    const older = await runImport(trend([9, 9, 9, 9]), { createdAt: "2025-01-01T00:00:00Z" });
    assert.match((older as { message: string }).message, /plus ancien/);
    assert.deepEqual(
      { prices: await priceState(), history: await histories(), guide: await guideCreatedAt() },
      before,
    );
  });

  it("nouveau guide le même jour, mêmes prix : import idempotent", async () => {
    const before = { prices: await priceState(), history: await histories() };
    const report = await imported(trend([1, 2, 3, 0]));
    assert.equal(report.baselinesWritten, 0);
    assert.deepEqual({ prices: await priceState(), history: await histories() }, before);
  });

  it("même jour, prix modifié : prix précédent = ancien prix du jour, archivé la veille", async () => {
    const report = await imported(trend([1.5, 2, 3]));
    assert.deepEqual(await priceState(), [[1.5, 1], [2, null], [3, null], null]);
    assert.deepEqual(await history(P[0]), { [dayKey(1)]: 1, [dayKey(0)]: 1.5 });
    assert.deepEqual(await history(P[1]), { [dayKey(0)]: 2 });
    assert.equal(report.baselinesWritten, 1);
  });

  it("même jour, réimport identique : le prix précédent est conservé", async () => {
    const report = await imported(trend([1.5, 2, 3]));
    assert.deepEqual(await priceState(), [[1.5, 1], [2, null], [3, null], null]);
    assert.deepEqual(await history(P[0]), { [dayKey(1)]: 1, [dayKey(0)]: 1.5 });
    assert.equal(report.baselinesWritten, 0);
  });

  it("variation de moins d'un centime : pas considérée comme un changement", async () => {
    await imported(trend([1.501, 2.004, 3]));
    assert.deepEqual(await priceState(), [[1.5, 1], [2, null], [3, null], null]);
  });

  it("le lendemain : nouveau snapshot, prix précédent mis à jour, cache de courbe conservé", async () => {
    await shiftDays(1);
    await seedHistoryCache();
    const report = await imported(trend([1.5, 2.5, 3]));
    assert.deepEqual(await priceState(), [[1.5, 1], [2.5, 2], [3, null], null]);
    assert.deepEqual(await histories(), [
      { [dayKey(2)]: 1, [dayKey(1)]: 1.5, [dayKey(0)]: 1.5 },
      { [dayKey(1)]: 2, [dayKey(0)]: 2.5 },
      { [dayKey(1)]: 3, [dayKey(0)]: 3 },
      {},
    ]);
    assert.equal(report.snapshotsWritten, 3);
    assert.equal(report.baselinesWritten, 0, "la veille existe déjà : rien à archiver");
    assert.equal(await prisma.portfolioHistoryCache.count(), 1, "aucun historique supprimé : le cache reste valable");
  });

  it("prix disparu (0 dans le guide) : prix et tout son historique supprimés, cache de courbe vidé", async () => {
    await imported(trend([1.5, 2.5, 0]));
    assert.deepEqual(await priceState(), [[1.5, 1], [2.5, 2], null, null]);
    assert.deepEqual(await history(P[2]), {});
    assert.deepEqual(await history(P[0]), { [dayKey(2)]: 1, [dayKey(1)]: 1.5, [dayKey(0)]: 1.5 });
    assert.equal(await prisma.portfolioHistoryCache.count(), 0, "le cache de courbe doit être vidé");
  });

  it("carte nouvellement cotée : prix sans précédent, pas d'archive la veille", async () => {
    await imported(trend([1.5, 2.5, undefined, 4]));
    assert.deepEqual((await priceState())[3], [4, null]);
    assert.deepEqual(await history(P[3]), { [dayKey(0)]: 4 });
  });

  it("aucun prix associable : erreur, prix et date du guide intacts", async () => {
    const before = { prices: await priceState(), history: await histories(), guide: await guideCreatedAt() };
    await assert.rejects(runImport({ [UNKNOWN_ID]: 3 }), /Aucun prix tendance n'a pu être associé/);
    await assert.rejects(runImport(trend([0, 0, 0, 0])), /Aucun prix tendance/);
    assert.deepEqual(
      { prices: await priceState(), history: await histories(), guide: await guideCreatedAt() },
      before,
    );
  });

  it("guide sans date : refusé, puis importé avec force (date effacée)", async () => {
    await assert.rejects(runImport(trend([1.5, 2.5, undefined, 4]), { createdAt: null }), /n'a pas de date/);
    const report = await imported(trend([1.5, 2.5, undefined, 4]), { createdAt: null, force: true, gzip: true });
    assert.equal(report.guideCreatedAt, null);
    assert.equal(await guideCreatedAt(), null);
    // Plus de date de référence : le guide suivant est accepté normalement.
    await imported(trend([1.5, 2.5, undefined, 4]));
  });

  it("force sur un guide déjà importé : réimporté", async () => {
    const guide = await guideCreatedAt();
    const report = await imported(trend([1.5, 2.5, undefined, 4]), { createdAt: guide, force: true });
    assert.equal(report.printingsPriced, 3);
  });

  it("produits scellés : catégories, impression EN + FR au même prix, idempotent", async () => {
    const nonsingles = {
      products: [
        { idProduct: BOX_ID, name: "Fixture Booster Box", categoryName: "Cyberpunk Booster Boxes", idCategory: 1670 },
        { idProduct: LOT_ID, name: "Fixture Lot", categoryName: "CPK Set" },
      ],
    };
    const report = await imported({ ...trend([1.5, 2.5, undefined, 4]), [BOX_ID]: 99.99 }, { nonsingles });
    assert.equal(report.sealedProducts, 2);
    assert.equal(report.sealedPriced, 2, "une ligne par langue");
    const sealed = await prisma.printing.findMany({
      where: { externalId: { startsWith: SEALED_PREFIX } },
      include: { set: true, card: true, prices: true },
      orderBy: { externalId: "asc" },
    });
    assert.deepEqual(
      sealed.map((row) => [row.externalId, row.language, row.set.code, row.card.cardType, row.prices.map((p) => Number(p.amount))]),
      [
        [`cardmarket:${BOX_ID}`, "en", "sealed-booster-boxes", "Sealed", [99.99]],
        [`cardmarket:${BOX_ID}:fr`, "fr", "sealed-booster-boxes", "Sealed", [99.99]],
        [`cardmarket:${LOT_ID}`, "en", "sealed-lots", "Lot", []],
        [`cardmarket:${LOT_ID}:fr`, "fr", "sealed-lots", "Lot", []],
      ],
    );
    const boxes = await prisma.set.findUniqueOrThrow({ where: { code: "sealed-booster-boxes" } });
    assert.equal(
      boxes.cardCount,
      await prisma.printing.count({ where: { setId: boxes.id, isActive: true, language: "en" } }),
    );

    // Visuel ajouté à la main sur l'impression EN : recopié sur la FR au prochain import.
    await prisma.printing.update({
      where: { externalId: `cardmarket:${BOX_ID}` },
      data: { imagePath: "/images/box.webp", sourceImageUrl: "https://example.com/box.webp" },
    });
    await imported({ ...trend([1.5, 2.5, undefined, 4]), [BOX_ID]: 89.5 }, { nonsingles });
    const fr = await prisma.printing.findUniqueOrThrow({ where: { externalId: `cardmarket:${BOX_ID}:fr` } });
    assert.equal(fr.imagePath, "/images/box.webp");
    assert.equal(await prisma.printing.count({ where: { externalId: { startsWith: SEALED_PREFIX } } }), 4);
    const boxPrice = await prisma.price.findFirstOrThrow({ where: { printing: { externalId: `cardmarket:${BOX_ID}` } } });
    assert.deepEqual([Number(boxPrice.amount), Number(boxPrice.previousAmount)], [89.5, 99.99]);

    // Guide suivant sans fichier des scellés : les impressions scellées existantes restent cotées.
    await imported({ ...trend([1.5, 2.5, undefined, 4]), [BOX_ID]: 89.5 });
    assert.equal(await prisma.price.count({ where: { printing: { externalId: { startsWith: `cardmarket:${BOX_ID}` } } } }), 2);
  });

  // BUG : après un jour sans import (guide Cardmarket non publié, cron en échec…), un prix INCHANGÉ
  // reçoit pour la veille un snapshot égal à son ancien `previousAmount` (price-import.ts:207-214),
  // alors que le prix de la veille était le prix actuel. La courbe montre un faux creux / pic.
  // Ex. : P1 vaut 1,50 depuis J-3 (précédent 1,00) ; import à J-0 sans import à J-1 → J-1 = 1,00.
  // Attendu : pas de snapshot J-1 (ou 1,50). Observé : snapshot J-1 à 1,00 (et 2,00 pour P2).
  it.fails("BUG: après un jour sauté, un prix inchangé reçoit un faux snapshot la veille", async () => {
    await shiftDays(2);
    await imported({ ...trend([1.5, 2.5, undefined, 4]), [BOX_ID]: 89.5 });
    const p1 = await history(P[0]);
    assert.equal(p1[dayKey(2)], 1.5, "état de départ : 1,50 à J-2");
    assert.equal(p1[dayKey(0)], 1.5);
    assert.ok(p1[dayKey(1)] === undefined || p1[dayKey(1)] === 1.5, `J-1 inventé : ${p1[dayKey(1)]}`);
  });
});
