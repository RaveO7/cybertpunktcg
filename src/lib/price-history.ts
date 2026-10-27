/**
 * Exemplaires possédés. `fromDay` : date d'achat (« AAAA-MM-JJ »), les exemplaires ne comptent qu'à partir
 * de ce jour (absente = possédés depuis toujours). `cost` : prix d'achat unitaire en EUR (absent = inconnu).
 */
export type OwnedQuantity = { printingId: string; quantity: number; fromDay?: string | null; cost?: number | null };

export type SnapshotRow = {
  printingId: string;
  day: string;
  amount: number;
};

export type PortfolioHistoryPoint = {
  day: string;
  marketTotal: number;
  pricedCopies: number;
  /** Prix d'achat cumulé (EUR) des exemplaires possédés ce jour-là ; absent sans aucun prix d'achat. */
  invested?: number;
  /** Valeur marché moins prix d'achat, sur les exemplaires qui ont les deux ; null = aucun. */
  profit?: number | null;
};

/** Jour UTC à minuit. */
export function utcDay(value: Date | string = new Date()) {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) throw new Error("Date de snapshot invalide.");
  // « 2026-02-30 » serait reporté au 2 mars : une date calendaire impossible est refusée.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0, 10) !== value) {
    throw new Error("Date de snapshot invalide.");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcDayKey(value: Date | string = new Date()) {
  return utcDay(value).toISOString().slice(0, 10);
}

export function shiftUtcDay(value: Date | string, days: number) {
  const base = utcDay(value);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/**
 * Construit la courbe de valeur marché d'un portefeuille.
 * Pour chaque jour, on reprend le dernier prix connu (<= jour) de chaque printing possédé.
 */
export function buildPortfolioHistory(
  owned: OwnedQuantity[],
  snapshots: SnapshotRow[],
): PortfolioHistoryPoint[] {
  return extendPortfolioHistory(owned, new Map(), snapshots).points;
}

/**
 * Prolonge une courbe : `lastPrice` contient les derniers prix connus avant les
 * `snapshots` fournis (tous postérieurs). Renvoie les nouveaux points et les prix
 * connus à la fin, pour reprendre plus tard sans relire l'historique.
 */
export function extendPortfolioHistory(
  owned: OwnedQuantity[],
  startPrices: ReadonlyMap<string, number>,
  snapshots: SnapshotRow[],
): { points: PortfolioHistoryPoint[]; lastPrice: Map<string, number> } {
  const rows = owned.filter((row) => row.quantity > 0);
  const printingIds = new Set(rows.map((row) => row.printingId));
  // Investi et P&L ne sont ajoutés aux points que si au moins un exemplaire a un prix d'achat.
  const withCosts = rows.some((row) => row.cost != null && Number.isFinite(row.cost));
  const lastPrice = new Map(startPrices);
  if (rows.length === 0) return { points: [], lastPrice };

  const byDay = new Map<string, { printingId: string; amount: number }[]>();
  for (const snapshot of snapshots) {
    if (!printingIds.has(snapshot.printingId)) continue;
    if (!Number.isFinite(snapshot.amount) || snapshot.amount <= 0) continue;
    const list = byDay.get(snapshot.day) ?? [];
    list.push({ printingId: snapshot.printingId, amount: snapshot.amount });
    byDay.set(snapshot.day, list);
  }
  const days = [...byDay.keys()].sort();

  const points: PortfolioHistoryPoint[] = [];
  for (const day of days) {
    for (const row of byDay.get(day) ?? []) lastPrice.set(row.printingId, row.amount);
    let marketTotal = 0;
    let pricedCopies = 0;
    let invested = 0;
    let profit = 0;
    let hasProfit = false;
    for (const row of rows) {
      // Pas encore acheté ce jour-là.
      if (row.fromDay != null && row.fromDay > day) continue;
      const cost = row.cost != null && Number.isFinite(row.cost) ? row.cost * row.quantity : null;
      if (cost != null) invested += cost;
      const amount = lastPrice.get(row.printingId);
      if (amount == null) continue;
      marketTotal += amount * row.quantity;
      pricedCopies += row.quantity;
      if (cost != null) {
        profit += amount * row.quantity - cost;
        hasProfit = true;
      }
    }
    if (pricedCopies === 0) continue;
    points.push({
      day,
      marketTotal: round2(marketTotal),
      pricedCopies,
      ...(withCosts ? { invested: round2(invested), profit: hasProfit ? round2(profit) : null } : {}),
    });
  }
  return { points, lastPrice };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildPrintingHistory(snapshots: SnapshotRow[]): { day: string; amount: number }[] {
  const byDay = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (!Number.isFinite(snapshot.amount) || snapshot.amount <= 0) continue;
    byDay.set(snapshot.day, snapshot.amount);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, amount]) => ({ day, amount: Math.round(amount * 100) / 100 }));
}
