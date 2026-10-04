import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import {
  buildPortfolioHistory,
  buildPrintingHistory,
  extendPortfolioHistory,
  type OwnedQuantity,
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

export async function loadPortfolioPriceHistory(input: {
  userId: string;
  setCode?: string;
  language?: string;
}): Promise<{ points: PortfolioHistoryPoint[]; days: number }> {
  const items = await prisma.collectionItem.findMany({
    where: {
      userId: input.userId,
      quantity: { gt: 0 },
      ...(input.setCode || input.language
        ? {
            printing: {
              ...(input.setCode ? { set: setCodeWhere(input.setCode) } : {}),
              ...(input.language ? { language: input.language } : {}),
            },
          }
        : {}),
    },
    select: { printingId: true, quantity: true },
  });
  const owned = new Map<string, number>();
  for (const item of items) {
    owned.set(item.printingId, (owned.get(item.printingId) ?? 0) + item.quantity);
  }
  const printingIds = [...owned.keys()];
  if (printingIds.length === 0) return { points: [], days: 0 };
  const ownedList = [...owned.entries()].map(([printingId, quantity]) => ({ printingId, quantity }));

  const scope = `${input.setCode ?? "*"}|${input.language ?? "*"}`;
  try {
    return await loadWithCache(input.userId, scope, owned, printingIds, ownedList);
  } catch (error) {
    // Le cache n'est qu'une optimisation (ex. table absente en production) : la courbe reste disponible.
    console.warn("[investment-history] cache indisponible, calcul complet :", error);
    return computeFullHistory(printingIds, ownedList, await loadSnapshotRows(printingIds, null));
  }
}

async function loadWithCache(
  userId: string,
  scope: string,
  owned: Map<string, number>,
  printingIds: string[],
  ownedList: OwnedQuantity[],
): Promise<{ points: PortfolioHistoryPoint[]; days: number }> {
  const fingerprint = collectionFingerprint(owned);
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
async function computeFullHistory(printingIds: string[], ownedList: OwnedQuantity[], allRows: SnapshotRow[]) {
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
  const points = buildPortfolioHistory(ownedList, allRows);
  return { points, days: points.length };
}

/** Changer cette valeur invalide tous les caches (ex. si le calcul de la courbe évolue). */
const CACHE_VERSION = "1";
const SETTLE_DELAY_DAYS = 2;

function collectionFingerprint(owned: Map<string, number>) {
  const entries = [...owned.entries()].sort(([left], [right]) => left.localeCompare(right));
  const hash = createHash("sha256").update(CACHE_VERSION);
  for (const [printingId, quantity] of entries) hash.update(`|${printingId}:${quantity}`);
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

/**
 * Prix de référence de chaque printing possédé au début d'une période :
 * dernier snapshot <= `day` (ou le plus ancien si `day` est nul).
 * Sans snapshot assez ancien, on prend le plus ancien connu (ou le prix précédent
 * Cardmarket quand il n'existe qu'un seul jour d'historique, comme la courbe).
 */
export async function loadReferencePrices(input: {
  userId: string;
  day: string | null;
}): Promise<Record<string, number>> {
  const items = await prisma.collectionItem.findMany({
    where: { userId: input.userId, quantity: { gt: 0 } },
    select: { printingId: true },
  });
  const printingIds = [...new Set(items.map((item) => item.printingId))];
  if (printingIds.length === 0) return {};
  const rows = await loadSnapshotRows(printingIds, null);
  const reference = new Map<string, number>();
  const earliest = new Map<string, number>();
  const dayCount = new Map<string, number>();
  for (const row of rows) {
    dayCount.set(row.printingId, (dayCount.get(row.printingId) ?? 0) + 1);
    if (!earliest.has(row.printingId)) earliest.set(row.printingId, row.amount);
    if (input.day != null && row.day <= input.day) reference.set(row.printingId, row.amount);
  }
  const singleDay = printingIds.filter((id) => !reference.has(id) && (dayCount.get(id) ?? 0) <= 1);
  if (singleDay.length > 0) {
    const prices = await prisma.price.findMany({
      where: {
        kind: "trend",
        source: { code: "cardmarket" },
        printingId: { in: singleDay },
        previousAmount: { not: null },
      },
      select: { printingId: true, previousAmount: true },
    });
    for (const price of prices) {
      const amount = Number(price.previousAmount?.toString());
      if (Number.isFinite(amount) && amount > 0) reference.set(price.printingId, amount);
    }
  }
  for (const [printingId, amount] of earliest) {
    if (!reference.has(printingId)) reference.set(printingId, amount);
  }
  return Object.fromEntries(reference);
}
