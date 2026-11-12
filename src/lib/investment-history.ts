import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  buildPortfolioHistory,
  buildPrintingHistory,
  extendPortfolioHistory,
  type OwnedQuantity,
  type PortfolioHistoryOptions,
  type SnapshotRow,
  shiftUtcDay,
  type PortfolioHistoryPoint,
  utcDay,
  utcDayKey,
} from "./price-history";
import { CARDS_GROUP_FILTER, SEALED_GROUP_FILTER, SEALED_SET_PREFIX } from "./reference-data";

function setCodeWhere(setCode: string) {
  if (setCode === CARDS_GROUP_FILTER) return { NOT: { code: { startsWith: SEALED_SET_PREFIX } } };
  if (setCode === SEALED_GROUP_FILTER) return { code: { startsWith: SEALED_SET_PREFIX } };
  return { code: setCode };
}

/** Achat daté d'une ligne de la collection, pour le placer sur la courbe. */
export type PortfolioPurchase = {
  day: string;
  printingId: string;
  quantity: number;
  /** Prix d'achat unitaire (dans `currency`), null = inconnu. */
  unitPrice: number | null;
  currency: string | null;
};

type PortfolioHistory = { points: PortfolioHistoryPoint[]; days: number };

export async function loadPortfolioPriceHistory(input: {
  userId: string;
  setCode?: string;
  language?: string;
  /** Exemplaires de la collection retenus dans le détail (sélection, recherche, performance). */
  itemIds?: string[];
}): Promise<PortfolioHistory & { purchases: PortfolioPurchase[] }> {
  const items = await prisma.collectionItem.findMany({
    where: {
      userId: input.userId,
      quantity: { gt: 0 },
      ...(input.itemIds?.length ? { id: { in: input.itemIds } } : {}),
      ...(input.setCode || input.language
        ? {
            printing: {
              ...(input.setCode ? { set: setCodeWhere(input.setCode) } : {}),
              ...(input.language ? { language: input.language } : {}),
            },
          }
        : {}),
    },
    select: { printingId: true, quantity: true, purchasePrice: true, purchaseCurrency: true, purchasedAt: true },
    orderBy: { addedAt: "asc" },
  });
  const ownedList: OwnedQuantity[] = items.map((item) => {
    const price = item.purchasePrice == null ? null : Number(item.purchasePrice.toString());
    const eur = price != null && Number.isFinite(price) && (item.purchaseCurrency || "EUR") === "EUR";
    return {
      printingId: item.printingId,
      quantity: item.quantity,
      fromDay: item.purchasedAt ? utcDayKey(item.purchasedAt) : null,
      cost: eur ? price : null,
    };
  });
  const purchases: PortfolioPurchase[] = items
    .filter((item) => item.purchasedAt != null)
    .map((item) => {
      const price = item.purchasePrice == null ? null : Number(item.purchasePrice.toString());
      const unitPrice = price != null && Number.isFinite(price) ? price : null;
      return {
        day: utcDayKey(item.purchasedAt as Date),
        printingId: item.printingId,
        quantity: item.quantity,
        unitPrice,
        currency: unitPrice == null ? null : item.purchaseCurrency || "EUR",
      };
    })
    .sort((left, right) => left.day.localeCompare(right.day));
  const printingIds = [...new Set(items.map((item) => item.printingId))];
  if (printingIds.length === 0) return { points: [], days: 0, purchases: [] };

  // Ensemble d'exemplaires : calcul complet, pas de ligne de cache par ensemble. Cartes précises : tout
  // leur historique de prix, y compris avant l'achat (l'investi et le P&L partent de l'achat).
  if (input.itemIds?.length) {
    const rows = await loadSnapshotRows(printingIds, null);
    return { ...(await computeFullHistory(printingIds, ownedList, rows, { valueBeforePurchase: true })), purchases };
  }

  const scope = `${input.setCode ?? "*"}|${input.language ?? "*"}`;
  try {
    return { ...(await loadWithCache(input.userId, scope, printingIds, ownedList)), purchases };
  } catch (error) {
    // Le cache n'est qu'une optimisation (ex. table absente en production) : la courbe reste disponible.
    console.warn("[investment-history] cache indisponible, calcul complet :", error);
    return { ...(await computeFullHistory(printingIds, ownedList, await loadSnapshotRows(printingIds, null))), purchases };
  }
}

async function loadWithCache(
  userId: string,
  scope: string,
  printingIds: string[],
  ownedList: OwnedQuantity[],
): Promise<PortfolioHistory> {
  const fingerprint = collectionFingerprint(ownedList);
  const cache = await prisma.portfolioHistoryCache.findUnique({
    where: { userId_scope: { userId, scope } },
  });
  const usable = cache?.fingerprint === fingerprint ? cache : null;
  const cachedPoints: PortfolioHistoryPoint[] = usable ? JSON.parse(usable.pointsJson) : [];
  const cachedPrices = new Map<string, number>(usable ? Object.entries(JSON.parse(usable.lastPricesJson)) : []);
  const cachedLastDay = usable?.lastDay ?? null;

  // Sans cache valide : tout l'historique. Sinon : seulement les jours après le dernier figé.
  const rows = await loadSnapshotRows(printingIds, cachedLastDay);

  const dayKeys = new Set(rows.map((row) => row.day));
  if (cachedPoints.length + dayKeys.size <= 1) {
    // Pas encore d'historique : calcul complet (léger), non mis en cache.
    return computeFullHistory(
      printingIds,
      ownedList,
      cachedLastDay ? await loadSnapshotRows(printingIds, null) : rows,
    );
  }

  // Les deux derniers jours peuvent encore être réécrits par l'import des prix : on ne fige que <= J-2.
  const settledDay = utcDayKey(shiftUtcDay(utcDay(), -SETTLE_DELAY_DAYS));
  const settledRows = rows.filter((row) => row.day <= settledDay);
  const recentRows = rows.filter((row) => row.day > settledDay);

  const settled = extendPortfolioHistory(ownedList, cachedPrices, settledRows);
  const settledPoints = [...cachedPoints, ...settled.points];
  const settledLastDay = settledRows.reduce<string | null>(
    (max, row) => (max == null || row.day > max ? row.day : max),
    cachedLastDay,
  );

  if (!usable || settledRows.length > 0) {
    const data = {
      fingerprint,
      lastDay: settledLastDay,
      lastPricesJson: JSON.stringify(Object.fromEntries(settled.lastPrice)),
      pointsJson: JSON.stringify(settledPoints),
    };
    await prisma.portfolioHistoryCache.upsert({
      where: { userId_scope: { userId, scope } },
      create: { userId, scope, ...data },
      update: data,
    });
  }

  const recent = extendPortfolioHistory(ownedList, settled.lastPrice, recentRows);
  const points = [...settledPoints, ...recent.points];
  return { points, days: points.length };
}

/** Courbe complète sans cache. Avec un seul jour d'historique, on ajoute la veille à partir du prix précédent. */
async function computeFullHistory(
  printingIds: string[],
  ownedList: OwnedQuantity[],
  allRows: SnapshotRow[],
  options: PortfolioHistoryOptions = {},
) {
  if (new Set(allRows.map((row) => row.day)).size <= 1) {
    const prices = await prisma.price.findMany({
      where: {
        kind: "trend",
        source: { code: "cardmarket" },
        printingId: { in: printingIds },
        previousAmount: { not: null },
      },
      select: { printingId: true, previousAmount: true },
    });
    const priorDay = utcDayKey(shiftUtcDay(utcDay(), -1));
    for (const price of prices) {
      const amount = Number(price.previousAmount?.toString());
      if (!Number.isFinite(amount) || amount <= 0) continue;
      allRows.push({ printingId: price.printingId, day: priorDay, amount });
    }
  }
  const points = buildPortfolioHistory(ownedList, allRows, options);
  return { points, days: points.length };
}

/** Changer cette valeur invalide tous les caches (ex. si le calcul de la courbe évolue). */
const CACHE_VERSION = "2";
const SETTLE_DELAY_DAYS = 2;

/** Empreinte des exemplaires (quantité, date et prix d'achat) : toute modification invalide le cache. */
function collectionFingerprint(owned: OwnedQuantity[]) {
  const entries = owned
    .map((row) => `${row.printingId}:${row.quantity}:${row.fromDay ?? ""}:${row.cost ?? ""}`)
    .sort();
  const hash = createHash("sha256").update(CACHE_VERSION);
  for (const entry of entries) hash.update(`|${entry}`);
  return hash.digest("hex");
}

async function loadSnapshotRows(printingIds: string[], afterDay: string | null): Promise<SnapshotRow[]> {
  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      kind: "trend",
      source: { code: "cardmarket" },
      printingId: { in: printingIds },
      ...(afterDay ? { day: { gt: utcDay(afterDay) } } : {}),
    },
    select: { printingId: true, amount: true, day: true },
    orderBy: { day: "asc" },
  });
  return snapshots.map((row) => ({
    printingId: row.printingId,
    day: utcDayKey(row.day),
    amount: Number(row.amount.toString()),
  }));
}

/** À appeler quand l'historique passé des prix est modifié (suppression de snapshots…). */
export async function clearPortfolioHistoryCache() {
  await prisma.portfolioHistoryCache.deleteMany({});
}

export async function loadPrintingPriceHistory(printingId: string) {
  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      printingId,
      kind: "trend",
      source: { code: "cardmarket" },
    },
    select: { amount: true, day: true },
    orderBy: { day: "asc" },
  });
  return buildPrintingHistory(
    snapshots.map((row) => ({
      printingId,
      day: utcDayKey(row.day),
      amount: Number(row.amount.toString()),
    })),
  );
}

/** Snapshots retenus par la courbe : tendance Cardmarket, prix nuls ignorés. */
const PRICED_SNAPSHOT: Prisma.PriceSnapshotWhereInput = {
  kind: "trend",
  source: { code: "cardmarket" },
  amount: { gt: 0 },
};

/**
 * Prix de référence de chaque printing possédé au début d'une période de `days` jours,
 * comptée depuis le dernier jour d'historique (comme la courbe ; aujourd'hui sans historique) :
 * dernier snapshot <= ce jour (ou le plus ancien si `days` est nul = tout l'historique).
 * Sans snapshot assez ancien, on prend le plus ancien connu (ou le prix précédent
 * Cardmarket quand il n'existe qu'un seul jour d'historique, comme la courbe).
 * La base renvoie un jour par carte (agrégats), jamais tout l'historique.
 */
export async function loadReferencePrices(input: {
  userId: string;
  days: number | null;
}): Promise<{ day: string | null; prices: Record<string, number> }> {
  const items = await prisma.collectionItem.findMany({
    where: { userId: input.userId, quantity: { gt: 0 } },
    select: { printingId: true },
  });
  const printingIds = [...new Set(items.map((item) => item.printingId))];
  const owned: Prisma.PriceSnapshotWhereInput = { ...PRICED_SNAPSHOT, printingId: { in: printingIds } };
  // Premier et dernier jour coté de chaque carte.
  const spans =
    printingIds.length > 0
      ? await prisma.priceSnapshot.groupBy({ by: ["printingId"], where: owned, _min: { day: true }, _max: { day: true } })
      : [];
  const lastDay = spans.reduce<string | null>((max, span) => {
    const key = span._max.day ? utcDayKey(span._max.day) : null;
    return key != null && (max == null || key > max) ? key : max;
  }, null);
  const day = input.days == null ? null : utcDayKey(shiftUtcDay(lastDay ?? utcDayKey(), -input.days));
  if (printingIds.length === 0) return { day, prices: {} };

  // Dernier jour coté au plus tard le premier jour de la période.
  const referenceDay = new Map<string, Date>();
  if (day != null) {
    const before = await prisma.priceSnapshot.groupBy({
      by: ["printingId"],
      where: { ...owned, day: { lt: shiftUtcDay(day, 1) } },
      _max: { day: true },
    });
    for (const row of before) if (row._max.day) referenceDay.set(row.printingId, row._max.day);
  }
  const spanById = new Map(spans.map((span) => [span.printingId, span]));
  const earliestDay = new Map<string, Date>();
  const singleDay: string[] = [];
  for (const printingId of printingIds) {
    if (referenceDay.has(printingId)) continue;
    const first = spanById.get(printingId)?._min.day;
    const last = spanById.get(printingId)?._max.day;
    if (first) earliestDay.set(printingId, first);
    if (!first || first.getTime() === last?.getTime()) singleDay.push(printingId);
  }

  const [amounts, previous] = await Promise.all([
    snapshotAmounts(new Map([...referenceDay, ...earliestDay])),
    singleDay.length > 0
      ? prisma.price.findMany({
          where: {
            kind: "trend",
            source: { code: "cardmarket" },
            printingId: { in: singleDay },
            previousAmount: { not: null },
          },
          select: { printingId: true, previousAmount: true },
        })
      : [],
  ]);
  const reference = new Map<string, number>();
  for (const printingId of referenceDay.keys()) {
    const amount = amounts.get(printingId);
    if (amount != null) reference.set(printingId, amount);
  }
  for (const price of previous) {
    const amount = Number(price.previousAmount?.toString());
    if (Number.isFinite(amount) && amount > 0) reference.set(price.printingId, amount);
  }
  for (const printingId of earliestDay.keys()) {
    const amount = amounts.get(printingId);
    if (amount != null && !reference.has(printingId)) reference.set(printingId, amount);
  }
  return { day, prices: Object.fromEntries(reference) };
}

/** Prix d'un jour précis par carte, en une requête (les cartes d'un même jour sont regroupées). */
async function snapshotAmounts(dayByPrinting: ReadonlyMap<string, Date>) {
  const byDay = new Map<number, string[]>();
  for (const [printingId, day] of dayByPrinting) {
    const group = byDay.get(day.getTime());
    if (group) group.push(printingId);
    else byDay.set(day.getTime(), [printingId]);
  }
  if (byDay.size === 0) return new Map<string, number>();
  const rows = await prisma.priceSnapshot.findMany({
    where: {
      ...PRICED_SNAPSHOT,
      OR: [...byDay].map(([time, ids]) => ({ day: new Date(time), printingId: { in: ids } })),
    },
    select: { printingId: true, amount: true },
  });
  return new Map(rows.map((row) => [row.printingId, Number(row.amount.toString())]));
}
