"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { intlLocale } from "@/i18n/config";
import { ChartHeader } from "./price-chart/ChartHeader";
import { ChartLegend } from "./price-chart/ChartLegend";
import { ChartSvg } from "./price-chart/ChartSvg";
import { ChartTooltip } from "./price-chart/ChartTooltip";
import { formatDay, formatDayRange } from "./price-chart/format";
import { computeGeometry, periodDelta } from "./price-chart/geometry";
import type { ChartPoint } from "./price-chart/types";
import { useChartPointer } from "./price-chart/use-chart-pointer";
import { useChartState } from "./price-chart/use-chart-state";
import { useElementWidth } from "./price-chart/use-element-width";

type PriceChartProps = {
  points: ChartPoint[];
  label?: string;
  emptyHint?: string;
  height?: number;
  compact?: boolean;
};

export function PriceChart({ points: allPoints, label, emptyHint, height, compact = false }: PriceChartProps) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const locale = useLocale();
  const resolvedLabel = label ?? t("chart.label");
  const resolvedEmpty = emptyHint ?? t("chart.empty");
  const resolvedHeight = height ?? (compact ? 150 : 280);
  const uid = useId().replace(/:/g, "");
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth(container);
  const localeTag = intlLocale(locale);

  const { points, zoomed, canZoom, hover, setHover, selection, setSelection, zoomTo, resetZoom } = useChartState(
    allPoints,
    compact,
  );

  const hasInvested = points.some((point) => point.invested != null && point.invested > 0);
  const hasPurchases = points.some((point) => (point.purchases?.length ?? 0) > 0);

  const geometry = useMemo(
    () => computeGeometry({ points, width, height: resolvedHeight, compact, hasInvested }),
    [compact, hasInvested, resolvedHeight, points, width],
  );

  const { handlePointer, handlePointerDown, handlePointerUp, handlePointerCancel } = useChartPointer({
    points,
    geometry,
    canZoom,
    selection,
    setSelection,
    setHover,
    zoomTo,
  });

  if (points.length === 0) {
    // Compact : le conteneur porte déjà le titre, seule l'explication reste.
    if (compact) return <p className="text-xs leading-relaxed text-muted">{resolvedEmpty}</p>;
    return (
      <div className="border border-line bg-panel px-4 py-8 text-sm text-muted">
        <p className="font-mono text-[10px] tracking-[0.14em] text-cyan uppercase">{resolvedLabel}</p>
        <p className="mt-3">{resolvedEmpty}</p>
      </div>
    );
  }

  const active = hover == null ? null : points[hover];
  const activeCoord = hover != null && geometry ? geometry.coords[hover] : null;
  const lastCoord = geometry ? geometry.coords[geometry.coords.length - 1] : null;
  // Pendant une sélection, l'en-tête donne la variation de la période sélectionnée.
  // Variation connue dès le premier rendu (largeur pas encore mesurée) : le badge ne change pas de taille ensuite.
  const period = selection ? periodDelta(points.slice(selection.from, selection.to + 1)) : (geometry ?? periodDelta(points));
  const periodLength = selection ? selection.to - selection.from + 1 : points.length;
  const showDots = geometry != null && points.length <= Math.max(2, geometry.innerWidth / 18);

  const selectionCoords =
    selection && geometry ? { from: geometry.coords[selection.from], to: geometry.coords[selection.to] } : null;

  return (
    <div className={compact ? "" : "border border-line bg-panel p-4 sm:p-5"}>
      {/* Compact : courbe seule, le prix et sa variation sont affichés par le conteneur. */}
      {!compact ? (
        <ChartHeader
          label={resolvedLabel}
          value={active?.value ?? geometry?.last ?? points[points.length - 1].value}
          subtitle={
            selection
              ? formatDayRange(points[selection.from].day, points[selection.to].day, localeTag)
              : active
                ? formatDay(active.day, localeTag, true)
                : t("chart.period")
          }
          delta={period.delta}
          deltaPct={period.deltaPct}
          profitBased={period.profitBased}
          periodLength={periodLength}
          showPeriodLength={points.length > 1}
          localeTag={localeTag}
        />
      ) : null}
      {!compact && (hasInvested || hasPurchases) ? (
        <ChartLegend hasInvested={hasInvested} hasPurchases={hasPurchases} />
      ) : null}
      <div
        ref={setContainer}
        className={`relative w-full select-none ${canZoom ? "cursor-crosshair" : ""}`}
        data-no-swipe=""
        // touch-action est ignoré sur les éléments internes d'un SVG : il doit être porté par ce conteneur.
        // Au doigt : glisser horizontalement parcourt la courbe, verticalement fait défiler la page.
        style={{ height: resolvedHeight, touchAction: "pan-y", WebkitTouchCallout: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointer}
        onPointerUp={handlePointerUp}
        // Au doigt, le dernier point reste affiché après avoir relâché ; la souris l'efface en sortant.
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHover(null);
        }}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={zoomed ? resetZoom : undefined}
      >
        {geometry ? (
          <ChartSvg
            geometry={geometry}
            points={points}
            uid={uid}
            width={width}
            height={resolvedHeight}
            compact={compact}
            ariaLabel={`${resolvedLabel} : ${fmt.money(geometry.last)}`}
            localeTag={localeTag}
            showDots={showDots}
            hasPurchases={hasPurchases}
            activeCoord={activeCoord}
            lastCoord={lastCoord}
            selectionCoords={selectionCoords}
          />
        ) : null}

        {active && activeCoord && geometry ? (
          <ChartTooltip
            active={active}
            coord={activeCoord}
            paddingTop={geometry.padding.top}
            width={width}
            compact={compact}
            localeTag={localeTag}
          />
        ) : null}
      </div>
      {zoomed ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t("chart.zoomed", { range: formatDayRange(points[0].day, points[points.length - 1].day, localeTag) })}</span>
          {/* Marges négatives : zone de toucher agrandie sans changer la hauteur de la ligne. */}
          <button type="button" onClick={resetZoom} className="-my-2 py-2 text-cyan hover:text-yellow">
            {t("chart.resetZoom")}
          </button>
        </div>
      ) : canZoom ? (
        <p className="mt-3 text-xs text-muted">
          <span className="pointer-coarse:hidden">{t("chart.zoomHint")}</span>
          <span className="hidden pointer-coarse:inline">{t("chart.zoomHintTouch")}</span>
        </p>
      ) : null}
    </div>
  );
}
