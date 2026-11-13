// Durée affichée par le graphique de valeur et fenêtre de dates correspondante (sans React : testable seule).

import type { ChartPoint, ChartPurchase } from "@/components/PriceChart";

export type ChartRange = "1d" | "1w" | "1m" | "1y" | "all";

export const CHART_RANGE_DAYS: Record<ChartRange, number | null> = { "1d": 1, "1w": 7, "1m": 30, "1y": 365, all: null };

/** Premier jour de la fenêtre, compté depuis le dernier point connu (nul = tout l’historique). */
export function chartRangeStart(points: ChartPoint[], range: ChartRange) {
  const days = CHART_RANGE_DAYS[range];
  if (days == null) return null;
  const last = new Date(`${points.length > 0 ? points[points.length - 1].day : new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  last.setUTCDate(last.getUTCDate() - days);
  return last.toISOString().slice(0, 10);
}

/** Garde les points dont le jour est dans la fenêtre. */
export function filterChartRange(points: ChartPoint[], range: ChartRange) {
  const cutoff = chartRangeStart(points, range);
  if (cutoff == null) return points;
  return points.filter((point) => point.day >= cutoff);
}

/**
 * Place chaque achat sur le premier point de la courbe à sa date ou après (le dernier point s'il est plus
 * récent que l'historique). Les achats antérieurs au début de la durée choisie sont ignorés ; en « Total »,
 * ceux d'avant le premier jour d'historique vont sur le premier point.
 */
export function attachPurchases(points: ChartPoint[], purchases: ChartPurchase[], rangeStart: string | null) {
  if (points.length === 0 || purchases.length === 0) return points;
  const byIndex = new Map<number, ChartPurchase[]>();
  for (const purchase of purchases) {
    if (rangeStart != null && purchase.day < rangeStart) continue;
    let index = points.findIndex((point) => point.day >= purchase.day);
    if (index === -1) index = points.length - 1;
    byIndex.set(index, [...(byIndex.get(index) ?? []), purchase]);
  }
  if (byIndex.size === 0) return points;
  return points.map((point, index) => (byIndex.has(index) ? { ...point, purchases: byIndex.get(index) } : point));
}
