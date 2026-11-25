import { ACCENT, AXIS_TEXT, BACKGROUND, GRID, INVESTED, LINE, PURCHASE } from "./colors";
import { AXIS_FONT_SIZE, formatAxisMoney, formatDay } from "./format";
import type { ChartGeometry } from "./geometry";
import type { ChartPoint } from "./types";

type Coord = { x: number; y: number };

type ChartSvgProps = {
  geometry: ChartGeometry;
  points: ChartPoint[];
  uid: string;
  width: number;
  height: number;
  compact: boolean;
  ariaLabel: string;
  localeTag: string;
  showDots: boolean;
  hasPurchases: boolean;
  activeCoord: Coord | null;
  lastCoord: Coord | null;
  selectionCoords: { from: Coord; to: Coord } | null;
};

/** Courbe : grille, axes, période sélectionnée, tracé, investi, achats et repère du point actif. */
export function ChartSvg({
  geometry,
  points,
  uid,
  width,
  height,
  compact,
  ariaLabel,
  localeTag,
  showDots,
  hasPurchases,
  activeCoord,
  lastCoord,
  selectionCoords,
}: ChartSvgProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 block select-none"
      role="img"
      aria-label={ariaLabel}
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
            y={height - 8}
            textAnchor={anchor}
            fill={AXIS_TEXT}
            fontSize={compact ? 10 : 11}
          >
            {formatDay(points[index].day, localeTag)}
          </text>
        );
      })}

      {selectionCoords ? (
        <g pointerEvents="none">
          <rect
            x={selectionCoords.from.x}
            y={geometry.padding.top}
            width={selectionCoords.to.x - selectionCoords.from.x}
            height={geometry.innerHeight}
            fill={LINE}
            fillOpacity="0.1"
          />
          {[selectionCoords.from.x, selectionCoords.to.x].map((x, index) => (
            <line
              key={index}
              x1={x}
              x2={x}
              y1={geometry.padding.top}
              y2={geometry.baseline}
              stroke={LINE}
              strokeOpacity="0.6"
            />
          ))}
        </g>
      ) : null}

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
  );
}
