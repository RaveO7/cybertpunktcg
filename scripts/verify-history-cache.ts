/**
 * Vérifie le cache de la courbe de portefeuille (PortfolioHistoryCache).
 * Travaille sur une COPIE de data/collection.db : la vraie base n'est jamais modifiée.
 *
 * Chaque résultat est comparé à une implémentation de référence naïve, écrite ici
 * indépendamment du code testé (dernier prix connu <= jour, pour chaque jour).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const sourceDb = path.join(root, "data", "collection.db");
if (!existsSync(sourceDb)) throw new Error(`base introuvable: ${sourceDb}`);
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "cptcg-history-"));
const dbFile = path.join(tmpDir, "test.db");
copyFileSync(sourceDb, dbFile);
process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, "/")}`;

// Schéma à jour sur la copie, même si la base de dev est en retard.
const push = spawnSync("node", ["scripts/prisma.mjs", "db", "push", "--skip-generate", "--accept-data-loss"], {
  cwd: root,
  env: process.env,
  encoding: "utf8",
  shell: true,
});
if (push.status !== 0) throw new Error(`prisma db push a échoué:\n${push.stdout}\n${push.stderr}`);

type Point = { day: string; marketTotal: number; pricedCopies: number };
type Filter = { setCode?: string; language?: string };

let step = 0;
function ok(label: string) {
  step += 1;
  console.log(`  ✓ ${step}. ${label}`);
}

async function main() {
  // Imports après DATABASE_URL : le client Prisma doit pointer vers la copie.
  const { prisma } = await import("../src/lib/prisma");
  const { loadPortfolioPriceHistory, clearPortfolioHistoryCache } = await import("../src/lib/investment-history");
  const { utcDay, utcDayKey, shiftUtcDay } = await import("../src/lib/price-history");
  const { POST: register } = await import("../src/app/api/auth/register/route");
  const { GET: historyRoute } = await import("../src/app/api/investment/history/route");
  const { SESSION_COOKIE } = await import("../src/lib/auth");

  const day = (ago: number) => utcDayKey(shiftUtcDay(utcDay(), -ago));
  const source = await prisma.priceSource.findUniqueOrThrow({ where: { code: "cardmarket" } });
  const [nm, lp] = await prisma.condition.findMany({ orderBy: { sortOrder: "asc" }, take: 2 });

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
  const [P1, P2, P4] = await printingsOf("welcometonightcityretail", 3);
  const [P3] = await printingsOf("welcometonightcityretail-fr", 1);
  const [P5] = await printingsOf("welcometonightcitybeta", 1);
  const tracked = [P1, P2, P3, P4, P5];

  // Historique maîtrisé : on remplace tous les snapshots des cartes suivies.
  async function setHistory(printingId: string, byAgo: Record<number, number>) {
    await prisma.priceSnapshot.deleteMany({ where: { printingId } });
    await prisma.priceSnapshot.createMany({
      data: Object.entries(byAgo).map(([ago, amount]) => ({
        printingId,
        sourceId: source.id,
        kind: "trend",
        amount,
        currency: "EUR",
        day: utcDay(day(Number(ago))),
      })),
    });
  }
  async function setSnapshot(printingId: string, ago: number, amount: number) {
    const key = { printingId, sourceId: source.id, kind: "trend", day: utcDay(day(ago)) };
    await prisma.priceSnapshot.upsert({
      where: { printingId_sourceId_kind_day: key },
      create: { ...key, amount, currency: "EUR" },
      update: { amount },
    });
  }
  // P1 : trous dans l'historique (report du dernier prix). P2 : un prix à 0 (ignoré).
  // P3 : n'a de prix qu'à partir de J-4. P4 : jamais coté.
  const P1_HISTORY = { 9: 1, 8: 1.25, 6: 2, 3: 2.5, 1: 3, 0: 3.1 };
  const P2_HISTORY = { 9: 10, 5: 12, 3: 0, 2: 11 };
  const P3_HISTORY = { 4: 0.5, 0: 0.75 };
  await setHistory(P1, P1_HISTORY);
  await setHistory(P2, P2_HISTORY);
  await setHistory(P3, P3_HISTORY);
  await prisma.priceSnapshot.deleteMany({ where: { printingId: P4 } });
  await setHistory(P5, { 0: 4 });
  await prisma.price.deleteMany({ where: { printingId: { in: tracked } } });
  await prisma.portfolioHistoryCache.deleteMany({});

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  async function makeUser(label: string, lines: { printingId: string; quantity: number; conditionId?: string }[]) {
    const user = await prisma.user.create({ data: { id: `histo-${label}-${stamp}`, displayName: label } });
    for (const line of lines) {
      await prisma.collectionItem.create({
        data: {
          userId: user.id,
          printingId: line.printingId,
          conditionId: line.conditionId ?? nm.id,
          quantity: line.quantity,
        },
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
      await prisma.priceSnapshot.findMany({
        where: { printingId: { in: [...owned.keys()] }, kind: "trend", sourceId: source.id },
      })
    )
      .map((row) => ({ printingId: row.printingId, day: utcDayKey(row.day), amount: Number(row.amount) }))
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
  const load = (userId: string, filter: Filter = {}) => loadPortfolioPriceHistory({ userId, ...filter });

  async function expectMatches(userId: string, label: string, filter: Filter = {}) {
    const expected = await reference(userId, filter);
    const actual = await load(userId, filter);
    assert.deepEqual(actual.points, expected, `${label} : courbe différente de la référence`);
    assert.equal(actual.days, expected.length, `${label} : nombre de jours faux`);
    return actual.points;
  }

  // U1 : P1 sur deux états (quantités cumulées par carte), P2, P3 (fr), P4 jamais coté.
  const U1 = await makeUser("u1", [
    { printingId: P1, quantity: 2, conditionId: nm.id },
    { printingId: P1, quantity: 1, conditionId: lp.id },
    { printingId: P2, quantity: 1 },
    { printingId: P3, quantity: 4 },
    { printingId: P4, quantity: 5 },
  ]);

  console.log("verify-history-cache");

  // 1. Premier calcul identique à la référence, valeurs vérifiées à la main.
  const cold = await expectMatches(U1, "premier calcul");
  assert.deepEqual(cold.map((p) => p.day), [9, 8, 6, 5, 4, 3, 2, 1, 0].map(day));
  // J-0 : P1 3,1×3 + P2 11×1 + P3 0,75×4 = 23,30 € ; P4 n'est jamais compté.
  assert.deepEqual(cold.at(-1), { day: day(0), marketTotal: 23.3, pricedCopies: 8 });
  // J-3 : le prix 0 de P2 est ignoré, on garde 12 (J-5).
  assert.deepEqual(cold.find((p) => p.day === day(3)), { day: day(3), marketTotal: 21.5, pricedCopies: 8 });
  ok("premier calcul = référence (trous, prix à 0, carte jamais cotée, quantités cumulées)");

  // 2. Le cache ne fige que les jours <= J-2.
  const row = await cacheRow(U1);
  assert.ok(row, "aucune ligne de cache créée");
  assert.equal(row.lastDay, day(2), "le dernier jour figé doit être J-2");
  const frozen: Point[] = JSON.parse(row.pointsJson);
  assert.deepEqual(frozen, cold.filter((p) => p.day <= day(2)), "points figés incorrects");
  assert.deepEqual(JSON.parse(row.lastPricesJson), { [P1]: 2.5, [P2]: 11, [P3]: 0.5 }, "derniers prix figés incorrects");
  ok("cache figé jusqu'à J-2 avec les bons derniers prix");

  // 3. Second appel : même résultat, aucune réécriture inutile.
  await expectMatches(U1, "second appel");
  const rowAgain = await cacheRow(U1);
  assert.equal(rowAgain?.updatedAt.getTime(), row.updatedAt.getTime(), "le cache est réécrit sans raison");
  ok("second appel identique, pas d'écriture");

  // 4. Le cache est vraiment utilisé : un changement dans le passé figé n'est pas relu…
  await setSnapshot(P1, 6, 50);
  assert.deepEqual((await load(U1)).points, cold, "l'historique figé a été relu au lieu du cache");
  // … jusqu'à ce que le cache soit vidé (ce que fait l'import quand il supprime des snapshots).
  await clearPortfolioHistoryCache();
  assert.equal(await prisma.portfolioHistoryCache.count(), 0, "clearPortfolioHistoryCache ne vide pas tout");
  const withChange = await expectMatches(U1, "après vidage du cache");
  assert.notDeepEqual(withChange, cold, "le changement passé devrait apparaître après vidage");
  await setSnapshot(P1, 6, 2);
  await clearPortfolioHistoryCache();
  await expectMatches(U1, "retour à l'historique initial");
  ok("le passé figé vient du cache ; vidage = recalcul");

  // 5. Les deux derniers jours restent vivants (l'import peut les réécrire).
  await setSnapshot(P1, 1, 7);
  await setSnapshot(P1, 0, 8);
  await setSnapshot(P2, 1, 20);
  const live = await expectMatches(U1, "jours récents modifiés");
  assert.deepEqual(live.at(-1), { day: day(0), marketTotal: 47, pricedCopies: 8 });
  ok("J-1 et J-0 relus à chaque appel");

  // 6. Reprise incrémentale : un cache ancien (figé à J-6) est prolongé sans tout relire.
  await prisma.priceSnapshot.deleteMany({ where: { printingId: { in: tracked }, day: { gt: utcDay(day(6)) } } });
  await clearPortfolioHistoryCache();
  await expectMatches(U1, "historique tronqué");
  assert.equal((await cacheRow(U1))?.lastDay, day(6), "cache de départ mal figé");
  // « Les jours passent » : les imports suivants ajoutent J-5 … J-0.
  await setHistory(P1, { ...P1_HISTORY, 1: 7, 0: 8 });
  await setHistory(P2, { ...P2_HISTORY, 1: 20 });
  await setHistory(P3, P3_HISTORY);
  await setHistory(P5, { 0: 4 });
  await expectMatches(U1, "reprise incrémentale");
  assert.equal((await cacheRow(U1))?.lastDay, day(2), "le cache n'a pas avancé jusqu'à J-2");
  await clearPortfolioHistoryCache();
  await expectMatches(U1, "reprise = calcul complet");
  ok("cache ancien prolongé = calcul complet, dernier jour avancé");

  // 7. Modifier la collection invalide le cache.
  const fingerprint = (await cacheRow(U1))?.fingerprint;
  const p2Line = await prisma.collectionItem.findFirstOrThrow({ where: { userId: U1, printingId: P2 } });
  await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 3 } });
  await expectMatches(U1, "quantité modifiée");
  assert.notEqual((await cacheRow(U1))?.fingerprint, fingerprint, "l'empreinte n'a pas changé");
  await prisma.collectionItem.create({ data: { userId: U1, printingId: P5, conditionId: nm.id, quantity: 2 } });
  await expectMatches(U1, "carte ajoutée");
  await prisma.collectionItem.deleteMany({ where: { userId: U1, printingId: P5 } });
  await expectMatches(U1, "carte retirée");
  await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 0 } });
  await expectMatches(U1, "quantité à zéro");
  await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 1 } });
  // Même total de cartes mais réparties autrement : l'empreinte doit différer.
  await expectMatches(U1, "retour quantité 1");
  const before = await cacheRow(U1);
  const p1Line = await prisma.collectionItem.findFirstOrThrow({ where: { userId: U1, printingId: P1, conditionId: nm.id } });
  await prisma.collectionItem.update({ where: { id: p1Line.id }, data: { quantity: 1 } });
  await prisma.collectionItem.update({ where: { id: p2Line.id }, data: { quantity: 2 } });
  await expectMatches(U1, "même nombre de cartes, répartition différente");
  assert.notEqual((await cacheRow(U1))?.fingerprint, before?.fingerprint);
  ok("ajout, retrait, quantité, répartition : toujours recalculé");

  // 8. Filtres set / langue : résultats justes et caches séparés.
  const bySet = await expectMatches(U1, "filtre set", { setCode: "welcometonightcityretail" });
  const byLang = await expectMatches(U1, "filtre langue", { language: "fr" });
  const all = await expectMatches(U1, "sans filtre");
  assert.notDeepEqual(bySet, all);
  assert.notDeepEqual(byLang, all);
  assert.ok(await cacheRow(U1, "welcometonightcityretail|*"), "cache du filtre set absent");
  assert.ok(await cacheRow(U1, "*|fr"), "cache du filtre langue absent");
  // Rejoués depuis le cache, chaque filtre garde son propre résultat.
  assert.deepEqual((await load(U1, { setCode: "welcometonightcityretail" })).points, bySet);
  assert.deepEqual((await load(U1, { language: "fr" })).points, byLang);
  assert.deepEqual((await load(U1)).points, all);
  assert.deepEqual((await load(U1, { setCode: "set-inexistant" })).points, []);
  ok("filtres set et langue justes, chacun son cache");

  // 9. Aucun mélange entre comptes.
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
  ok("comptes isolés, même avec des collections identiques");

  // 10. Historique d'un seul jour : on s'appuie sur le prix précédent, sans rien mettre en cache.
  const U4 = await makeUser("u4", [{ printingId: P5, quantity: 3 }]);
  await prisma.price.create({
    data: { printingId: P5, sourceId: source.id, kind: "trend", amount: 4, previousAmount: 3.5, currency: "EUR" },
  });
  const single = await load(U4);
  assert.deepEqual(single.points, [
    { day: day(1), marketTotal: 10.5, pricedCopies: 3 },
    { day: day(0), marketTotal: 12, pricedCopies: 3 },
  ]);
  assert.equal(await cacheRow(U4), null, "un historique d'un jour ne doit pas être mis en cache");
  ok("historique d'un jour complété par le prix précédent, non mis en cache");

  // 11. Collection vide.
  const U5 = await makeUser("u5", []);
  assert.deepEqual(await load(U5), { points: [], days: 0 });
  assert.equal(await cacheRow(U5), null);
  ok("collection vide");

  // 12. Suppression du compte : ses caches partent avec lui.
  assert.ok((await prisma.portfolioHistoryCache.count({ where: { userId: U1 } })) >= 3);
  await prisma.user.delete({ where: { id: U1 } });
  assert.equal(await prisma.portfolioHistoryCache.count({ where: { userId: U1 } }), 0);
  ok("caches supprimés avec le compte");

  // 13. Route HTTP /api/investment/history.
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
      { userId: apiUser.id, printingId: P1, conditionId: nm.id, quantity: 2 },
      { userId: apiUser.id, printingId: P3, conditionId: nm.id, quantity: 1 },
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
  ok("route HTTP : session requise, filtres, historique d'une carte");

  // 14. Table de cache absente (migration oubliée en production) : la courbe reste juste.
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
    assert.deepEqual((await load(U7)).points, single.points);
  } finally {
    console.warn = warn;
  }
  assert.ok(warnings.length >= 3, "l'échec du cache doit être signalé dans les logs");
  ok("table de cache absente : calcul complet, avertissement dans les logs");

  await prisma.$disconnect();
  console.log(JSON.stringify({ ok: true, checks: step }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows peut garder le fichier verrouillé quelques instants.
    }
  });
