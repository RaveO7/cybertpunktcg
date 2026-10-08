/**
 * Vérifie le cache de la courbe de portefeuille (PortfolioHistoryCache).
 * Travaille sur une COPIE de la base SQLite de DATABASE_URL : la vraie base n'est jamais modifiée.
 *
 * Chaque résultat est comparé à une implémentation de référence naïve, écrite ici
 * indépendamment du code testé (dernier prix connu <= jour, pour chaque jour).
 */
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { pushSchema, sqliteFile } from "../helpers/sqlite";

type Point = { day: string; marketTotal: number; pricedCopies: number };
type Filter = { setCode?: string; language?: string };
type Prisma = typeof import("../../src/lib/prisma").prisma;
type History = typeof import("../../src/lib/investment-history");
type PriceHistory = typeof import("../../src/lib/price-history");

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "cptcg-history-"));
const dbFile = path.join(tmpDir, "test.db");
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let prisma: Prisma;
let history: History;
let priceHistory: PriceHistory;
let register: typeof import("../../src/app/api/auth/register/route").POST;
let historyRoute: typeof import("../../src/app/api/investment/history/route").GET;
let SESSION_COOKIE: string;

let sourceId: string;
let nmId: string;
let lpId: string;
let P1: string;
let P2: string;
let P3: string;
let P4: string;
let P5: string;
let tracked: string[];

// P1 : trous dans l'historique (report du dernier prix). P2 : un prix à 0 (ignoré).
// P3 : n'a de prix qu'à partir de J-4. P4 : jamais coté.
const P1_HISTORY = { 9: 1, 8: 1.25, 6: 2, 3: 2.5, 1: 3, 0: 3.1 };
const P2_HISTORY = { 9: 10, 5: 12, 3: 0, 2: 11 };
const P3_HISTORY = { 4: 0.5, 0: 0.75 };

const day = (ago: number) => priceHistory.utcDayKey(priceHistory.shiftUtcDay(priceHistory.utcDay(), -ago));

async function printingsOf(setCode: string, count: number) {
  const rows = await prisma.printing.findMany({
    where: { set: { code: setCode } },
    orderBy: { collectorNumber: "asc" },
    take: count,
    select: { id: true },
  });
  assert.equal(rows.length, count, `pas assez de cartes dans ${setCode}`);
  return rows.map((row) => row.id);
}

// Historique maîtrisé : on remplace tous les snapshots des cartes suivies.
async function setHistory(printingId: string, byAgo: Record<number, number>) {
  await prisma.priceSnapshot.deleteMany({ where: { printingId } });
  await prisma.priceSnapshot.createMany({
    data: Object.entries(byAgo).map(([ago, amount]) => ({
      printingId,
      sourceId,
      kind: "trend",
      amount,
      currency: "EUR",
      day: priceHistory.utcDay(day(Number(ago))),
    })),
  });
}

async function setSnapshot(printingId: string, ago: number, amount: number) {
  const key = { printingId, sourceId, kind: "trend", day: priceHistory.utcDay(day(ago)) };
  await prisma.priceSnapshot.upsert({
    where: { printingId_sourceId_kind_day: key },
    create: { ...key, amount, currency: "EUR" },
    update: { amount },
  });
}

async function makeUser(label: string, lines: { printingId: string; quantity: number; conditionId?: string }[]) {
  const user = await prisma.user.create({ data: { id: `histo-${label}-${stamp}`, displayName: label } });
  for (const line of lines) {
    await prisma.collectionItem.create({
      data: { userId: user.id, printingId: line.printingId, conditionId: line.conditionId ?? nmId, quantity: line.quantity },
    });
  }
  return user.id;
}

/** Référence naïve, indépendante du code testé. */
async function reference(userId: string, filter: Filter = {}): Promise<Point[]> {
  const items = await prisma.collectionItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      printing: {
        ...(filter.setCode ? { set: { code: filter.setCode } } : {}),
        ...(filter.language ? { language: filter.language } : {}),
      },
    },
  });
  const owned = new Map<string, number>();
  for (const item of items) owned.set(item.printingId, (owned.get(item.printingId) ?? 0) + item.quantity);
  const snaps = (
    await prisma.priceSnapshot.findMany({ where: { printingId: { in: [...owned.keys()] }, kind: "trend", sourceId } })
  )
    .map((row) => ({ printingId: row.printingId, day: priceHistory.utcDayKey(row.day), amount: Number(row.amount) }))
    .filter((row) => row.amount > 0);
  const days = [...new Set(snaps.map((row) => row.day))].sort();
  const points: Point[] = [];
  for (const d of days) {
    let total = 0;
    let copies = 0;
    for (const [printingId, quantity] of owned) {
      const latest = snaps
        .filter((row) => row.printingId === printingId && row.day <= d)
        .sort((a, b) => a.day.localeCompare(b.day))
        .at(-1);
      if (!latest) continue;
      total += latest.amount * quantity;
      copies += quantity;
    }
    if (copies > 0) points.push({ day: d, marketTotal: Math.round(total * 100) / 100, pricedCopies: copies });
  }
  return points;
}

const cacheRow = (userId: string, scope = "*|*") =>
  prisma.portfolioHistoryCache.findUnique({ where: { userId_scope: { userId, scope } } });
const load = (userId: string, filter: Filter = {}) => history.loadPortfolioPriceHistory({ userId, ...filter });

async function expectMatches(userId: string, label: string, filter: Filter = {}) {
  const expected = await reference(userId, filter);
  const actual = await load(userId, filter);
  assert.deepEqual(actual.points, expected, `${label} : courbe différente de la référence`);
  assert.equal(actual.days, expected.length, `${label} : nombre de jours faux`);
  return actual.points;
}

beforeAll(async () => {
  copyFileSync(sqliteFile(process.env.DATABASE_URL ?? ""), dbFile);
  process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, "/")}`;
  // Schéma à jour sur la copie, même si la base de dev est en retard.
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
  history = await import("../../src/lib/investment-history");
  priceHistory = await import("../../src/lib/price-history");
  ({ POST: register } = await import("../../src/app/api/auth/register/route"));
  ({ GET: historyRoute } = await import("../../src/app/api/investment/history/route"));
  ({ SESSION_COOKIE } = await import("../../src/lib/auth"));

  sourceId = (await prisma.priceSource.findUniqueOrThrow({ where: { code: "cardmarket" } })).id;
  [nmId, lpId] = (await prisma.condition.findMany({ orderBy: { sortOrder: "asc" }, take: 2 })).map((row) => row.id);
  [P1, P2, P4] = await printingsOf("welcometonightcityretail", 3);
  [P3] = await printingsOf("welcometonightcityretail-fr", 1);
  [P5] = await printingsOf("welcometonightcitybeta", 1);
  tracked = [P1, P2, P3, P4, P5];

  await setHistory(P1, P1_HISTORY);
  await setHistory(P2, P2_HISTORY);
  await setHistory(P3, P3_HISTORY);
  await prisma.priceSnapshot.deleteMany({ where: { printingId: P4 } });
  await setHistory(P5, { 0: 4 });
  await prisma.price.deleteMany({ where: { printingId: { in: tracked } } });
  await prisma.portfolioHistoryCache.deleteMany({});
});

afterAll(async () => {
  await prisma?.$disconnect();
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Windows peut garder le fichier verrouillé quelques instants.
  }
});

describe.sequential("cache de la courbe de portefeuille", () => {
  let U1: string;
  let cold: Point[];
  let all: Point[];
  let single: Point[];

  it("premier calcul = référence (trous, prix à 0, carte jamais cotée, quantités cumulées)", async () => {
    // U1 : P1 sur deux états (quantités cumulées par carte), P2, P3 (fr), P4 jamais coté.
    U1 = await makeUser("u1", [
      { printingId: P1, quantity: 2, conditionId: nmId },
      { printingId: P1, quantity: 1, conditionId: lpId },
      { printingId: P2, quantity: 1 },
      { printingId: P3, quantity: 4 },
      { printingId: P4, quantity: 5 },
    ]);
    cold = await expectMatches(U1, "premier calcul");
    assert.deepEqual(cold.map((p) => p.day), [9, 8, 6, 5, 4, 3, 2, 1, 0].map(day));
    // J-0 : P1 3,1×3 + P2 11×1 + P3 0,75×4 = 23,30 € ; P4 n'est jamais compté.
    assert.deepEqual(cold.at(-1), { day: day(0), marketTotal: 23.3, pricedCopies: 8 });
    // J-3 : le prix 0 de P2 est ignoré, on garde 12 (J-5).
    assert.deepEqual(cold.find((p) => p.day === day(3)), { day: day(3), marketTotal: 21.5, pricedCopies: 8 });
  });

  it("cache figé jusqu'à J-2 avec les bons derniers prix ; second appel sans écriture", async () => {
    const row = await cacheRow(U1);
    assert.ok(row, "aucune ligne de cache créée");
    assert.equal(row.lastDay, day(2), "le dernier jour figé doit être J-2");
    const frozen: Point[] = JSON.parse(row.pointsJson);
    assert.deepEqual(frozen, cold.filter((p) => p.day <= day(2)), "points figés incorrects");
    assert.deepEqual(JSON.parse(row.lastPricesJson), { [P1]: 2.5, [P2]: 11, [P3]: 0.5 }, "derniers prix figés incorrects");

    await expectMatches(U1, "second appel");
    const rowAgain = await cacheRow(U1);
    assert.equal(rowAgain?.updatedAt.getTime(), row.updatedAt.getTime(), "le cache est réécrit sans raison");
  });

  it("le passé figé vient du cache ; vidage = recalcul", async () => {
    // Le cache est vraiment utilisé : un changement dans le passé figé n'est pas relu…
    await setSnapshot(P1, 6, 50);
    assert.deepEqual((await load(U1)).points, cold, "l'historique figé a été relu au lieu du cache");
    // … jusqu'à ce que le cache soit vidé (ce que fait l'import quand il supprime des snapshots).
    await history.clearPortfolioHistoryCache();
    assert.equal(await prisma.portfolioHistoryCache.count(), 0, "clearPortfolioHistoryCache ne vide pas tout");
    const withChange = await expectMatches(U1, "après vidage du cache");
    assert.notDeepEqual(withChange, cold, "le changement passé devrait apparaître après vidage");
    await setSnapshot(P1, 6, 2);
    await history.clearPortfolioHistoryCache();
    await expectMatches(U1, "retour à l'historique initial");
  });

  it("J-1 et J-0 relus à chaque appel", async () => {
    // Les deux derniers jours restent vivants (l'import peut les réécrire).
    await setSnapshot(P1, 1, 7);
    await setSnapshot(P1, 0, 8);
    await setSnapshot(P2, 1, 20);
    const live = await expectMatches(U1, "jours récents modifiés");
    assert.deepEqual(live.at(-1), { day: day(0), marketTotal: 47, pricedCopies: 8 });
  });

  it("cache ancien prolongé = calcul complet, dernier jour avancé", async () => {
    // Reprise incrémentale : un cache ancien (figé à J-6) est prolongé sans tout relire.
    await prisma.priceSnapshot.deleteMany({
      where: { printingId: { in: tracked }, day: { gt: priceHistory.utcDay(day(6)) } },
    });
    await history.clearPortfolioHistoryCache();
    await expectMatches(U1, "historique tronqué");
    assert.equal((await cacheRow(U1))?.lastDay, day(6), "cache de départ mal figé");
    // « Les jours passent » : les imports suivants ajoutent J-5 … J-0.
    await setHistory(P1, { ...P1_HISTORY, 1: 7, 0: 8 });
    await setHistory(P2, { ...P2_HISTORY, 1: 20 });
    await setHistory(P3, P3_HISTORY);
    await setHistory(P5, { 0: 4 });
    await expectMatches(U1, "reprise incrémentale");
    assert.equal((await cacheRow(U1))?.lastDay, day(2), "le cache n'a pas avancé jusqu'à J-2");
    await history.clearPortfolioHistoryCache();
    await expectMatches(U1, "reprise = calcul complet");
  });

  it("ajout, retrait, quantité, répartition : toujours recalculé", async () => {
    const fingerprint = (await cacheRow(U1))?.fingerprint;
    const p2Line = await prisma.collectionItem.findFirstOrThrow({ where: { userId: U1, printingId: P2 } });
    await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 3 } });
    await expectMatches(U1, "quantité modifiée");
    assert.notEqual((await cacheRow(U1))?.fingerprint, fingerprint, "l'empreinte n'a pas changé");
    await prisma.collectionItem.create({ data: { userId: U1, printingId: P5, conditionId: nmId, quantity: 2 } });
    await expectMatches(U1, "carte ajoutée");
    await prisma.collectionItem.deleteMany({ where: { userId: U1, printingId: P5 } });
    await expectMatches(U1, "carte retirée");
    await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 0 } });
    await expectMatches(U1, "quantité à zéro");
    await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 1 } });
    // Même total de cartes mais réparties autrement : l'empreinte doit différer.
    await expectMatches(U1, "retour quantité 1");
    const before = await cacheRow(U1);
    const p1Line = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: U1, printingId: P1, conditionId: nmId },
    });
    await prisma.collectionItem.update({ where: { id: p1Line.id }, data: { quantity: 1 } });
    await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 2 } });
    await expectMatches(U1, "même nombre de cartes, répartition différente");
    assert.notEqual((await cacheRow(U1))?.fingerprint, before?.fingerprint);
  });

  it("filtres set et langue justes, chacun son cache", async () => {
    const bySet = await expectMatches(U1, "filtre set", { setCode: "welcometonightcityretail" });
    const byLang = await expectMatches(U1, "filtre langue", { language: "fr" });
    all = await expectMatches(U1, "sans filtre");
    assert.notDeepEqual(bySet, all);
    assert.notDeepEqual(byLang, all);
    assert.ok(await cacheRow(U1, "welcometonightcityretail|*"), "cache du filtre set absent");
    assert.ok(await cacheRow(U1, "*|fr"), "cache du filtre langue absent");
    // Rejoués depuis le cache, chaque filtre garde son propre résultat.
    assert.deepEqual((await load(U1, { setCode: "welcometonightcityretail" })).points, bySet);
    assert.deepEqual((await load(U1, { language: "fr" })).points, byLang);
    assert.deepEqual((await load(U1)).points, all);
    assert.deepEqual((await load(U1, { setCode: "set-inexistant" })).points, []);
  });

  it("comptes isolés, même avec des collections identiques", async () => {
    const U2 = await makeUser("u2", [{ printingId: P1, quantity: 1 }]);
    const u2Points = await expectMatches(U2, "compte U2");
    assert.notDeepEqual(u2Points, all);
    await expectMatches(U1, "U1 après U2");
    // Collection identique à U1 (même empreinte) : chacun garde sa propre ligne.
    const u1Lines = await prisma.collectionItem.findMany({ where: { userId: U1 } });
    const U3 = await makeUser(
      "u3",
      u1Lines.map((line) => ({ printingId: line.printingId, quantity: line.quantity, conditionId: line.conditionId })),
    );
    await expectMatches(U3, "compte U3 identique à U1");
    assert.equal((await cacheRow(U3))?.fingerprint, (await cacheRow(U1))?.fingerprint);
    await prisma.collectionItem.updateMany({ where: { userId: U3, printingId: P2 }, data: { quantity: 9 } });
    await expectMatches(U3, "U3 modifié");
    await expectMatches(U1, "U1 intact après modification de U3");
  });

  it("historique d'un jour complété par le prix précédent, non mis en cache", async () => {
    const U4 = await makeUser("u4", [{ printingId: P5, quantity: 3 }]);
    await prisma.price.create({
      data: { printingId: P5, sourceId, kind: "trend", amount: 4, previousAmount: 3.5, currency: "EUR" },
    });
    single = (await load(U4)).points;
    assert.deepEqual(single, [
      { day: day(1), marketTotal: 10.5, pricedCopies: 3 },
      { day: day(0), marketTotal: 12, pricedCopies: 3 },
    ]);
    assert.equal(await cacheRow(U4), null, "un historique d'un jour ne doit pas être mis en cache");
  });

  it("collection vide", async () => {
    const U5 = await makeUser("u5", []);
    assert.deepEqual(await load(U5), { points: [], days: 0 });
    assert.equal(await cacheRow(U5), null);
  });

  it("caches supprimés avec le compte", async () => {
    assert.ok((await prisma.portfolioHistoryCache.count({ where: { userId: U1 } })) >= 3);
    await prisma.user.delete({ where: { id: U1 } });
    assert.equal(await prisma.portfolioHistoryCache.count({ where: { userId: U1 } }), 0);
  });

  it("route HTTP : session requise, filtres, historique d'une carte", async () => {
    const email = `histo.${stamp}@example.com`;
    const registered = await register(
      new Request("http://127.0.0.1/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "motdepasse-robuste", displayName: "Histo" }),
      }),
    );
    assert.ok(registered.ok, `inscription impossible: ${registered.status}`);
    const cookie = registered.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
    assert.ok(cookie, "pas de cookie de session");
    const apiUser = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.collectionItem.createMany({
      data: [
        { userId: apiUser.id, printingId: P1, conditionId: nmId, quantity: 2 },
        { userId: apiUser.id, printingId: P3, conditionId: nmId, quantity: 1 },
      ],
    });
    const call = (query: string, withCookie = true) =>
      historyRoute(
        new Request(`http://127.0.0.1/api/investment/history${query}`, {
          headers: withCookie ? { cookie: cookie.split(";")[0] } : {},
        }),
      );
    assert.equal((await call("", false)).status, 401, "la route doit exiger une session");
    for (const [query, filter] of [
      ["", {}],
      ["?set=all", {}],
      ["?set=welcometonightcityretail", { setCode: "welcometonightcityretail" }],
      ["?language=fr", { language: "fr" }],
    ] as const) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await call(query);
        assert.equal(response.status, 200);
        const body = (await response.json()) as { kind: string; points: Point[]; days: number };
        assert.equal(body.kind, "portfolio");
        assert.deepEqual(body.points, await reference(apiUser.id, filter), `route ${query || "(sans filtre)"}`);
      }
    }
    const printingResponse = await call(`?printingId=${P1}`);
    const printingBody = (await printingResponse.json()) as { points: { day: string; amount: number }[] };
    assert.deepEqual(
      printingBody.points,
      Object.entries({ ...P1_HISTORY, 1: 7, 0: 8 })
        .map(([ago, amount]) => ({ day: day(Number(ago)), amount }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    );
  });

  it("table de cache absente : calcul complet, avertissement dans les logs", async () => {
    // Migration oubliée en production : la courbe doit rester juste.
    const U6 = await makeUser("u6", [
      { printingId: P1, quantity: 2 },
      { printingId: P2, quantity: 1 },
    ]);
    const U7 = await makeUser("u7", [{ printingId: P5, quantity: 3 }]);
    const warn = console.warn;
    const warnings: unknown[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      await prisma.$executeRawUnsafe("DROP TABLE PortfolioHistoryCache");
      await expectMatches(U6, "sans table de cache");
      await expectMatches(U6, "sans table de cache, second appel", { setCode: "welcometonightcityretail" });
      // Historique d'un jour : le complément « prix précédent » marche aussi sans cache.
      assert.deepEqual((await load(U7)).points, single);
    } finally {
      console.warn = warn;
    }
    assert.ok(warnings.length >= 3, "l'échec du cache doit être signalé dans les logs");
  });
});
