"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ChartPoint } from "@/components/PriceChart";
import type { ChartRange } from "@/components/investment/chart-range";
import { ScreenError, ScreenSkeleton, SkeletonBlock } from "@/components/site/ScreenSkeleton";
import type { Translator } from "@/i18n/translator";

function chartRangeOptions(t: Translator): { value: ChartRange; label: string }[] {
  return [
    { value: "1d", label: t("investment.range1d") },
    { value: "1w", label: t("investment.range1w") },
    { value: "1m", label: t("investment.range1m") },
    { value: "1y", label: t("investment.range1y") },
    { value: "all", label: t("investment.rangeAll") },
  ];
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

/** Libellé d'une durée (« 1 mois »). */
export function chartRangeLabel(range: ChartRange, t: Translator) {
  return chartRangeOptions(t).find((option) => option.value === range)?.label ?? range;
}

/** Graphique de la valeur marché, avec le choix de la durée. */
export function InvestmentChart({
  chartRange,
  setChartRange,
  chartStatus,
  chartLoaded,
  rangedChartPoints,
  onRetry,
  referenceError,
  onRetryReference,
}: {
  chartRange: ChartRange;
  setChartRange: (range: ChartRange) => void;
  chartStatus: "loading" | "ready" | "error";
  chartLoaded: boolean;
  rangedChartPoints: ChartPoint[];
  onRetry: () => void;
  /** Prix de début de période introuvables : les variations du marché ne sont pas affichées. */
  referenceError: boolean;
  onRetryReference: () => void;
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
      {referenceError ? (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-danger">
          {t("investment.referenceError")}
          <button type="button" className="text-cyan hover:underline" onClick={onRetryReference}>
            {t("errors.retry")}
          </button>
        </p>
      ) : null}
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
