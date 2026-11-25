import { useRef, type PointerEvent } from "react";
import type { ChartGeometry } from "./geometry";
import type { ChartPoint } from "./types";

type Selection = { from: number; to: number };

type PointerInput = {
  points: ChartPoint[];
  geometry: ChartGeometry | null;
  canZoom: boolean;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  setHover: (index: number | null) => void;
  zoomTo: (from: string, to: string) => void;
};

/** Gestes sur la courbe : survol, glisser à la souris et pincement à deux doigts pour zoomer. */
export function useChartPointer({ points, geometry, canZoom, selection, setSelection, setHover, zoomTo }: PointerInput) {
  // Souris : point où le glisser a commencé. Doigts : point sous chaque doigt posé.
  const dragRef = useRef<number | null>(null);
  const touchesRef = useRef(new Map<number, number>());

  /** Position horizontale dans la zone de tracé et point le plus proche. */
  const pointerAt = (event: PointerEvent<HTMLDivElement>, plotLeft: number, plotWidth: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - plotLeft;
    const ratio = x / Math.max(1, plotWidth);
    const index = points.length === 1 ? 0 : Math.round(ratio * (points.length - 1));
    return { x, index: Math.min(points.length - 1, Math.max(0, index)) };
  };

  const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    const { x, index } = pointerAt(event, geometry.padding.left, geometry.innerWidth);
    const touches = touchesRef.current;
    if (touches.has(event.pointerId)) touches.set(event.pointerId, index);
    if (touches.size >= 2) {
      // Deux doigts : la période entre eux est sélectionnée.
      const [a, b] = [...touches.values()];
      setSelection({ from: Math.min(a, b), to: Math.max(a, b) });
      setHover(null);
      return;
    }
    if (dragRef.current != null) {
      const anchor = dragRef.current;
      setSelection(anchor === index ? null : { from: Math.min(anchor, index), to: Math.max(anchor, index) });
      setHover(index);
      return;
    }
    // Souris : seulement au survol de la zone de tracé. Doigt : partout sur le graphique.
    if (event.pointerType === "mouse" && (x < 0 || x > geometry.innerWidth)) {
      setHover(null);
      return;
    }
    setHover(index);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (canZoom && geometry) {
      const { x, index } = pointerAt(event, geometry.padding.left, geometry.innerWidth);
      if (event.pointerType === "mouse") {
        // Glisser à la souris sur la zone de tracé : sélection d'une période.
        if (event.button === 0 && x >= 0 && x <= geometry.innerWidth) {
          dragRef.current = index;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      } else if (event.pointerType === "touch") {
        touchesRef.current.set(event.pointerId, index);
      }
    }
    handlePointer(event);
  };

  // Fin du glisser (ou premier doigt levé) : zoom sur la période sélectionnée.
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const selecting = touchesRef.current.size >= 2 || (event.pointerType === "mouse" && dragRef.current != null);
    touchesRef.current.delete(event.pointerId);
    if (event.pointerType === "mouse") dragRef.current = null;
    if (!selecting) return;
    if (selection && selection.to > selection.from) zoomTo(points[selection.from].day, points[selection.to].day);
    setSelection(null);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    touchesRef.current.delete(event.pointerId);
    if (event.pointerType === "mouse") dragRef.current = null;
    setSelection(null);
    setHover(null);
  };

  return { handlePointer, handlePointerDown, handlePointerUp, handlePointerCancel };
}
