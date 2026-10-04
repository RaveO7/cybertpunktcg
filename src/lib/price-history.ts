export type OwnedQuantity = { printingId: string; quantity: number };

export type SnapshotRow = {
  printingId: string;
  day: string;
  amount: number;
};

export type PortfolioHistoryPoint = {
  day: string;
  marketTotal: number;
  pricedCopies: number;
};

/** Jour UTC à minuit. */
export function utcDay(value: Date | string = new Date()) {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) throw new Error("Date de snapshot invalide.");
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
  const quantities = new Map<string, number>();
  for (const row of owned) {
    if (row.quantity <= 0) continue;
    quantities.set(row.printingId, (quantities.get(row.printingId) ?? 0) + row.quantity);
  }
  const lastPrice = new Map(startPrices);
  if (quantities.size === 0) return { points: [], lastPrice };

  const byDay = new Map<string, { printingId: string; amount: number }[]>();
  for (const snapshot of snapshots) {
    if (!quantities.has(snapshot.printingId)) continue;
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
    for (const [printingId, quantity] of quantities) {
      const amount = lastPrice.get(printingId);
      if (amount == null) continue;
      marketTotal += amount * quantity;
      pricedCopies += quantity;
    }
    if (pricedCopies === 0) continue;
    points.push({
      day,
      marketTotal: Math.round(marketTotal * 100) / 100,
      pricedCopies,
    });
  }
  return { points, lastPrice };
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
