"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ChartPoint, ChartPurchase } from "@/components/PriceChart";
import { ScreenError, ScreenSkeleton, SkeletonBlock } from "@/components/site/ScreenSkeleton";
import type { Translator } from "@/i18n/translator";

// Durée affichée par le graphique de valeur, et fenêtre de dates correspondante.
export type ChartRange = "1d" | "1w" | "1m" | "1y" | "all";

const CHART_RANGE_DAYS: Record<ChartRange, number | null> = { "1d": 1, "1w": 7, "1m": 30, "1y": 365, all: null };

function chartRangeOptions(t: Translator): { value: ChartRange; label: string }[] {
  return [
    { value: "1d", label: t("investment.range1d") },
    { value: "1w", label: t("investment.range1w") },
    { value: "1m", label: t("investment.range1m") },
    { value: "1y", label: t("investment.range1y") },
    { value: "all", label: t("investment.rangeAll") },
  ];
}

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

function ChartLoading() {
  const t = useTranslations();
  return (
    <ScreenSkeleton label={t("investment.chartLoading")}>
      <SkeletonBlock className="h-[280px]" />
    </ScreenSkeleton>
  );
}

// Graphique chargé à la demande : il arrive en même temps que l'historique.
const PriceChart = dynamic(() => import("@/components/PriceChart").then((module) => module.PriceChart), {
  loading: ChartLoading,
});

/** Graphique de la valeur marché, avec le choix de la durée. */
export function InvestmentChart({
  chartRange,
  setChartRange,
  chartStatus,
  chartLoaded,
  rangedChartPoints,
  onRetry,
}: {
  chartRange: ChartRange;
  setChartRange: (range: ChartRange) => void;
  chartStatus: "loading" | "ready" | "error";
  chartLoaded: boolean;
  rangedChartPoints: ChartPoint[];
  onRetry: () => void;
}) {
  const t = useTranslations();
  return (

    <section className="flex flex-col gap-2">
      <div role="group" aria-label={t("investment.range")} className="flex border border-line bg-panel sm:self-start">
        {chartRangeOptions(t).map((option) => {
          const active = option.value === chartRange;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setChartRange(option.value)}
              className={`min-w-0 flex-1 border-l border-line px-1.5 py-2 text-xs whitespace-nowrap first:border-l-0 sm:flex-none sm:px-4 sm:text-sm ${
                active ? "bg-cyan/10 text-cyan" : "text-muted hover:text-cyan"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {chartStatus === "loading" && !chartLoaded ? (
        <ChartLoading />
      ) : chartStatus === "error" ? (
        <ScreenError message={t("investment.chartError")} onRetry={onRetry} />
      ) : (
        <div
          aria-busy={chartStatus === "loading"}
          className={`transition-opacity duration-200 ${chartStatus === "loading" ? "opacity-50" : "opacity-100"}`}
        >
          <PriceChart
            points={rangedChartPoints}
            label={t("investment.chartLabel")}
            emptyHint={t("investment.chartEmpty")}
          />
        </div>
      )}
    </section>
  );
}
