import { AXIS_FONT_SIZE, formatAxisMoney } from "./format";
import type { ChartPoint } from "./types";

/**
 * Variation affichée en tête. Avec des prix d'achat, c'est la variation de la plus / moins-value
 * (en % de l'investi à la fin) : un achat fait monter la valeur marché sans être un gain.
 * Plus-value absente au début (achats faits pendant la période) : elle part de 0.
 * Sinon, la variation de la valeur marché.
 */
export function periodDelta(points: ChartPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (last.profit != null && last.invested != null && last.invested > 0) {
    const delta = last.profit - (first.profit ?? 0);
    return { delta, deltaPct: delta / last.invested, profitBased: true };
  }
  return {
    delta: last.value - first.value,
    deltaPct: first.value > 0 ? (last.value - first.value) / first.value : null,
    profitBased: false,
  };
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

type GeometryInput = {
  points: ChartPoint[];
  width: number;
  height: number;
  compact: boolean;
  hasInvested: boolean;
};

/** Coordonnées, tracés et graduations de la courbe ; null tant que la largeur n'est pas mesurée. */
export function computeGeometry({ points, width, height, compact, hasInvested }: GeometryInput) {
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
  const innerHeight = Math.max(1, height - padding.top - padding.bottom);
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
}

export type ChartGeometry = NonNullable<ReturnType<typeof computeGeometry>>;
