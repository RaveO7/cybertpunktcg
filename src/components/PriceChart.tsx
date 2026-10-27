"use client";

import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { intlLocale } from "@/i18n/config";

/** Achat placé sur la courbe (le jour du point, ou le premier jour d'historique qui suit). */
export type ChartPurchase = {
  /** Date réelle de l'achat « AAAA-MM-JJ ». */
  day: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
  currency: string | null;
};

export type ChartPoint = {
  day: string;
  value: number;
  /** Prix d'achat cumulé à ce jour : tracé en pointillés quand il est fourni. */
  invested?: number | null;
  /** Plus / moins-value à ce jour (exemplaires avec prix d'achat). */
  profit?: number | null;
  purchases?: ChartPurchase[];
};

type PriceChartProps = {
  points: ChartPoint[];
  label?: string;
  emptyHint?: string;
  height?: number;
  compact?: boolean;
};

const LINE = "#3ee0ff";
const ACCENT = "#f5e642";
const INVESTED = "#e8eef7";
const PURCHASE = "#f5e642";
/** Achats listés au survol d'un point, au-delà : « +N autres ». */
const MAX_TOOLTIP_PURCHASES = 4;
const GRID = "#2c384c";
const AXIS_TEXT = "#93a0b4";
const BACKGROUND = "#07080d";

export function PriceChart({ points, label, emptyHint, height, compact = false }: PriceChartProps) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const locale = useLocale();
  const resolvedLabel = label ?? t("chart.label");
  const resolvedEmpty = emptyHint ?? t("chart.empty");
  const resolvedHeight = height ?? (compact ? 150 : 280);
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth(container);
  const localeTag = intlLocale(locale);

  const hasInvested = points.some((point) => point.invested != null && point.invested > 0);
  const hasPurchases = points.some((point) => (point.purchases?.length ?? 0) > 0);

  const geometry = useMemo(() => {
    if (points.length === 0 || width <= 0) return null;
    const values = points.map((point) => point.value);
    if (hasInvested) for (const point of points) if (point.invested != null) values.push(point.invested);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = Math.max(maxValue - minValue, maxValue * 0.04, 0.05);
    const ticks = niceTicks(Math.max(0, minValue - span * 0.12), maxValue + span * 0.12, compact ? 3 : 5);
    // Marge gauche dimensionnée sur le libellé d'axe le plus long (police mono ≈ 0.7em par caractère, avec marge).
    const longestTick = Math.max(...ticks.map((tick) => formatAxisMoney(tick).length));
    const labelWidth = Math.ceil(longestTick * AXIS_FONT_SIZE[compact ? "compact" : "full"] * 0.7);
    const padding = compact
      ? { top: 10, right: 10, bottom: 22, left: Math.max(44, labelWidth + 16) }
      : { top: 16, right: 18, bottom: 30, left: Math.max(58, labelWidth + 16) };
    const innerWidth = Math.max(1, width - padding.left - padding.right);
    const innerHeight = Math.max(1, resolvedHeight - padding.top - padding.bottom);
    const domainMin = ticks[0];
    const domainMax = ticks[ticks.length - 1];
    const xAt = (index: number) =>
      padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const yAt = (value: number) =>
      padding.top + ((domainMax - value) / (domainMax - domainMin || 1)) * innerHeight;
    const coords = points.map((point, index) => ({ x: xAt(index), y: yAt(point.value) }));
    const line = smoothPath(coords);
    // Investi : en marches, il ne change qu'au jour d'un achat.
    const investedLine = hasInvested
      ? points
          .map((point, index) => {
            const y = yAt(point.invested ?? 0).toFixed(2);
            const x = coords[index].x.toFixed(2);
            return index === 0 ? `M${x} ${y}` : `H${x} V${y}`;
          })
          .join(" ")
      : "";
    const baseline = padding.top + innerHeight;
    const area =
      coords.length > 1
        ? `${line} L${coords[coords.length - 1].x.toFixed(2)} ${baseline.toFixed(2)} L${coords[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`
        : "";
    const labelCount = Math.max(2, Math.min(points.length, Math.floor(innerWidth / (compact ? 90 : 110))));
    const xLabels =
      points.length === 1
        ? [0]
        : Array.from(new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i / (labelCount - 1)) * (points.length - 1)))));
    const first = points[0].value;
    const last = points[points.length - 1].value;
    return {
      padding,
      innerWidth,
      innerHeight,
      baseline,
      coords,
      line,
      investedLine,
      area,
      ticks,
      yAt,
      xLabels,
      ...periodDelta(points),
      last,
    };
  }, [compact, hasInvested, resolvedHeight, points, width]);

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
  const delta = geometry?.delta ?? 0;
  const trend = delta > 0.004 ? "up" : delta < -0.004 ? "down" : "flat";
  const deltaClass =
    trend === "up"
      ? "border-gain/40 bg-gain/10 text-gain"
      : trend === "down"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-line bg-panel-2 text-muted";
  const showDots = geometry != null && points.length <= Math.max(2, geometry.innerWidth / 18);
  const activePurchases = active?.purchases ?? [];
  const detailedTooltip =
    active != null && (active.invested != null || active.profit != null || activePurchases.length > 0);

  const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    // Souris : seulement au survol de la zone de tracé. Doigt : partout sur le graphique.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - geometry.padding.left;
    if (event.pointerType === "mouse" && (x < 0 || x > geometry.innerWidth)) {
      setHover(null);
      return;
    }
    const ratio = x / Math.max(1, geometry.innerWidth);
    const index = points.length === 1 ? 0 : Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  };

  return (
    <div className={compact ? "" : "border border-line bg-panel p-4 sm:p-5"}>
      {/* Compact : courbe seule, le prix et sa variation sont affichés par le conteneur. */}
      {!compact ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.14em] text-cyan uppercase">{resolvedLabel}</p>
            <p className="mt-2.5 font-mono text-lg leading-none text-yellow">
              {fmt.money(active?.value ?? geometry?.last ?? points[points.length - 1].value)}
            </p>
            <p className="mt-2.5 text-xs text-muted">{active ? formatDay(active.day, localeTag, true) : t("chart.period")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-2 whitespace-nowrap border px-2.5 py-1.5 font-mono leading-none tabular-nums ${deltaClass}`}
            >
              <span aria-hidden className="text-[0.7em]">
                {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"}
              </span>
              <span>
                {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                {fmt.money(Math.abs(delta))}
              </span>
              {geometry?.deltaPct != null ? (
                <span className="opacity-75">({formatPct(geometry.deltaPct, localeTag)})</span>
              ) : null}
            </span>
            {points.length > 1 ? (
              <span className="text-xs text-muted">
                {geometry?.profitBased ? `${t("chart.periodProfit")} · ` : ""}
                {t("chart.days", { n: points.length })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {!compact && (hasInvested || hasPurchases) ? (
        <ul className="-mt-3 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4" style={{ background: LINE }} />
            {t("chart.value")}
          </li>
          {hasInvested ? (
            <li className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: INVESTED, opacity: 0.7 }} />
              {t("chart.invested")}
            </li>
          ) : null}
          {hasPurchases ? (
            <li className="flex items-center gap-1.5">
              <span className="size-2 rotate-45" style={{ background: PURCHASE }} />
              {t("chart.purchase")}
            </li>
          ) : null}
        </ul>
      ) : null}
      <div
        ref={setContainer}
        className="relative w-full select-none"
        data-no-swipe=""
        // touch-action est ignoré sur les éléments internes d'un SVG : il doit être porté par ce conteneur.
        // Au doigt : glisser horizontalement parcourt la courbe, verticalement fait défiler la page.
        style={{ height: resolvedHeight, touchAction: "pan-y", WebkitTouchCallout: "none" }}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        // Au doigt, le dernier point reste affiché après avoir relâché ; la souris l'efface en sortant.
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHover(null);
        }}
        onPointerCancel={() => setHover(null)}
      >
        {geometry ? (
          <svg
            width={width}
            height={resolvedHeight}
            viewBox={`0 0 ${width} ${resolvedHeight}`}
            className="absolute inset-0 block select-none"
            role="img"
            aria-label={`${resolvedLabel} : ${fmt.money(geometry.last)}`}
          >
            <defs>
              <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity="0.28" />
                <stop offset="70%" stopColor={LINE} stopOpacity="0.06" />
                <stop offset="100%" stopColor={LINE} stopOpacity="0" />
              </linearGradient>
              <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {geometry.ticks.map((tick, index) => {
              const y = geometry.yAt(tick);
              return (
                <g key={tick}>
                  <line
                    x1={geometry.padding.left}
                    x2={width - geometry.padding.right}
                    y1={y}
                    y2={y}
                    stroke={GRID}
                    strokeOpacity={index === 0 ? 0.9 : 0.55}
                    strokeDasharray={index === 0 ? undefined : "2 5"}
                  />
                  <text
                    x={geometry.padding.left - 10}
                    y={y}
                    dominantBaseline="middle"
                    textAnchor="end"
                    fill={AXIS_TEXT}
                    fontSize={AXIS_FONT_SIZE[compact ? "compact" : "full"]}
                    className="font-mono"
                  >
                    {formatAxisMoney(tick)}
                  </text>
                </g>
              );
            })}

            {geometry.xLabels.map((index, position) => {
              const x = geometry.coords[index].x;
              const anchor =
                geometry.xLabels.length === 1
                  ? "middle"
                  : position === 0
                    ? "start"
                    : position === geometry.xLabels.length - 1
                      ? "end"
                      : "middle";
              return (
                <text
                  key={points[index].day}
                  x={x}
                  y={resolvedHeight - 8}
                  textAnchor={anchor}
                  fill={AXIS_TEXT}
                  fontSize={compact ? 10 : 11}
                >
                  {formatDay(points[index].day, localeTag)}
                </text>
              );
            })}

            {geometry.area ? <path d={geometry.area} fill={`url(#${uid}-fill)`} /> : null}
            <path
              d={geometry.line}
              fill="none"
              stroke={LINE}
              strokeWidth={compact ? 2 : 2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#${uid}-glow)`}
            />

            {geometry.investedLine ? (
              <path
                d={geometry.investedLine}
                fill="none"
                stroke={INVESTED}
                strokeOpacity="0.7"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
            ) : null}

            {showDots
              ? geometry.coords.map((coord, index) => (
                  <circle
                    key={points[index].day}
                    cx={coord.x}
                    cy={coord.y}
                    r={compact ? 2 : 2.5}
                    fill={BACKGROUND}
                    stroke={LINE}
                    strokeWidth="1.5"
                  />
                ))
              : null}

            {hasPurchases
              ? geometry.coords.map((coord, index) =>
                  points[index].purchases?.length ? (
                    <rect
                      key={`buy-${points[index].day}`}
                      x={coord.x - 4}
                      y={coord.y - 4}
                      width="8"
                      height="8"
                      transform={`rotate(45 ${coord.x} ${coord.y})`}
                      fill={PURCHASE}
                      stroke={BACKGROUND}
                      strokeWidth="1.5"
                      pointerEvents="none"
                    />
                  ) : null,
                )
              : null}

            {activeCoord ? (
              <g pointerEvents="none">
                <line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={geometry.padding.top}
                  y2={geometry.baseline}
                  stroke={ACCENT}
                  strokeOpacity="0.5"
                  strokeDasharray="3 4"
                />
                <circle cx={activeCoord.x} cy={activeCoord.y} r={compact ? 7 : 9} fill={ACCENT} fillOpacity="0.15" />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={compact ? 3.5 : 4.5}
                  fill={ACCENT}
                  stroke={BACKGROUND}
                  strokeWidth="2"
                />
              </g>
            ) : lastCoord ? (
              <g pointerEvents="none">
                <circle cx={lastCoord.x} cy={lastCoord.y} r={compact ? 6 : 8} fill={LINE} fillOpacity="0.18" />
                <circle cx={lastCoord.x} cy={lastCoord.y} r={compact ? 3 : 4} fill={ACCENT} stroke={BACKGROUND} strokeWidth="2" />
              </g>
            ) : null}
          </svg>
        ) : null}

        {active && activeCoord && geometry ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 border border-cyan/50 bg-black/95 px-2.5 py-1.5 whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            style={{
              left: activeCoord.x,
              // Bulle détaillée : posée en haut du tracé pour ne pas déborder sous le graphique.
              top: detailedTooltip ? geometry.padding.top : Math.max(geometry.padding.top, activeCoord.y),
              transform: detailedTooltip
                ? activeCoord.x > width * 0.62
                  ? "translateX(calc(-100% - 14px))"
                  : "translateX(14px)"
                : activeCoord.x > width * 0.62
                  ? "translate(calc(-100% - 14px), -50%)"
                  : "translate(14px, -50%)",
            }}
          >
            <p className="font-mono text-[10px] tracking-wide text-cyan uppercase">
              {formatDay(active.day, localeTag, true)}
            </p>
            <p className={`font-mono leading-none text-yellow ${compact ? "mt-0.5 text-sm" : "mt-1 text-base"}`}>
              {fmt.money(active.value)}
            </p>
            {active.invested != null || active.profit != null ? (
              <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
                {active.invested != null ? (
                  <>
                    <dt className="text-muted">{t("chart.invested")}</dt>
                    <dd className="text-right font-mono">{fmt.money(active.invested)}</dd>
                  </>
                ) : null}
                {active.profit != null ? (
                  <>
                    <dt className="text-muted">{t("chart.profit")}</dt>
                    <dd
                      className={`text-right font-mono ${active.profit > 0.004 ? "text-gain" : active.profit < -0.004 ? "text-danger" : "text-muted"}`}
                    >
                      {active.profit > 0 ? "+" : active.profit < 0 ? "−" : ""}
                      {fmt.money(Math.abs(active.profit))}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            {activePurchases.length > 0 ? (
              <div className="mt-2 border-t border-line pt-1.5 text-xs">
                <p className="font-mono text-[10px] tracking-wide text-yellow uppercase">
                  {t("chart.purchases", { n: activePurchases.length })}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {activePurchases.slice(0, MAX_TOOLTIP_PURCHASES).map((purchase, index) => (
                    <li key={index} className="flex max-w-[16rem] items-baseline gap-2">
                      <span className="shrink-0 font-mono text-muted">×{purchase.quantity}</span>
                      <span className="min-w-0 truncate">{purchase.title}</span>
                      <span className="ml-auto shrink-0 pl-2 font-mono">
                        {purchase.unitPrice == null ? "—" : fmt.money(purchase.unitPrice, purchase.currency || "EUR")}
                      </span>
                      {purchase.day !== active.day ? (
                        <span className="shrink-0 text-muted">{formatDay(purchase.day, localeTag)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {activePurchases.length > MAX_TOOLTIP_PURCHASES ? (
                  <p className="mt-0.5 text-muted">
                    {t("chart.morePurchases", { n: activePurchases.length - MAX_TOOLTIP_PURCHASES })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Variation affichée en tête. Avec des prix d'achat, c'est la variation de la plus / moins-value
 * (en % de l'investi à la fin) : un achat fait monter la valeur marché sans être un gain.
 * Sinon, la variation de la valeur marché.
 */
function periodDelta(points: ChartPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (first.profit != null && last.profit != null && last.invested != null && last.invested > 0) {
    const delta = last.profit - first.profit;
    return { delta, deltaPct: delta / last.invested, profitBased: true };
  }
  return {
    delta: last.value - first.value,
    deltaPct: first.value > 0 ? (last.value - first.value) / first.value : null,
    profitBased: false,
  };
}

/** Largeur de l'élément. Reçoit l'élément (ref callback) : le conteneur n'existe pas tant que
 *  la courbe est vide, la mesure doit démarrer quand il apparaît. */
function useElementWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element) return;
    const update = () => setWidth(Math.round(element.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

/** Courbe lissée (monotone) : ne dépasse jamais les valeurs réelles entre deux points. */
function smoothPath(coords: { x: number; y: number }[]) {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M${coords[0].x} ${coords[0].y}`;
  const n = coords.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    slopes.push((coords[i + 1].y - coords[i].y) / (coords[i + 1].x - coords[i].x || 1));
  }
  const tangents = coords.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    const a = slopes[i - 1];
    const b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const dx = (p1.x - p0.x) / 3;
    d += ` C${(p0.x + dx).toFixed(2)} ${(p0.y + tangents[i] * dx).toFixed(2)} ${(p1.x - dx).toFixed(2)} ${(p1.y - tangents[i + 1] * dx).toFixed(2)} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

/** Graduations « rondes » (1, 2, 2.5, 5 × 10^n) couvrant [min, max]. */
function niceTicks(min: number, max: number, count: number) {
  const range = Math.max(max - min, 0.01);
  const rough = range / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude;
  const start = Math.max(0, Math.floor(min / step) * step);
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks.length >= 2 ? ticks : [start, start + step];
}

function formatDay(day: string, localeTag: string, withYear = false) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(localeTag, {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date);
}

function formatPct(value: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
}

const AXIS_FONT_SIZE = { compact: 10, full: 11 } as const;

function formatAxisMoney(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k €`;
  if (value >= 100) return `${Math.round(value)} €`;
  return `${value.toFixed(value < 10 ? 2 : 1)} €`;
}
