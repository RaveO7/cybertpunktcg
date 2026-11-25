import { useMemo, useState } from "react";
import type { ChartPoint } from "./types";

/** Points affichés (après zoom), survol, période en cours de sélection. */
export function useChartState(allPoints: ChartPoint[], compact: boolean) {
  const [hover, setHover] = useState<number | null>(null);

  // Zoom : premier et dernier jour affichés. Oublié quand la durée reçue change (autre bouton de durée).
  const [zoom, setZoom] = useState<{ from: string; to: string } | null>(null);
  const span = allPoints.length > 0 ? `${allPoints[0].day}|${allPoints[allPoints.length - 1].day}` : "";
  const [zoomSpan, setZoomSpan] = useState(span);
  if (zoomSpan !== span) {
    setZoomSpan(span);
    setZoom(null);
  }
  const points = useMemo(() => {
    if (!zoom) return allPoints;
    const inside = allPoints.filter((point) => point.day >= zoom.from && point.day <= zoom.to);
    return inside.length >= 2 ? inside : allPoints;
  }, [allPoints, zoom]);
  const zoomed = points !== allPoints;
  const canZoom = !compact && points.length > 2;
  // Période en cours de sélection (indices dans `points`), avant le zoom.
  const [selectionState, setSelection] = useState<{ from: number; to: number } | null>(null);
  const selection = selectionState && selectionState.to < points.length ? selectionState : null;

  const zoomTo = (from: string, to: string) => {
    setZoom({ from, to });
    setHover(null);
  };

  const resetZoom = () => {
    setZoom(null);
    setHover(null);
  };

  return { points, zoomed, canZoom, hover, setHover, selection, setSelection, zoomTo, resetZoom };
}
