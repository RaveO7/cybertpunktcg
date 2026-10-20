"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { isModalOpen } from "@/components/use-modal";
import type { CardGridLayout } from "@/components/VirtualCardGrid";
import type { PrintingDTO } from "@/lib/types";

/**
 * Carte atteinte depuis `index` avec une touche de déplacement, dans une grille de `cols` colonnes
 * remplie ligne par ligne ; `null` pour une autre touche. On reste sur place au bord de la grille ;
 * vers le bas depuis l'avant-dernière ligne, on va à la dernière carte si la colonne est vide.
 */
export function neighborIndex(index: number, key: string, cols: number, count: number): number | null {
  if (count <= 0) return null;
  const columns = Math.max(1, cols);
  const current = Math.min(Math.max(index, 0), count - 1);
  switch (key) {
    case "ArrowRight":
      return Math.min(current + 1, count - 1);
    case "ArrowLeft":
      return Math.max(current - 1, 0);
    case "ArrowDown": {
      if (current + columns < count) return current + columns;
      const lastRow = Math.floor((count - 1) / columns);
      return Math.floor(current / columns) < lastRow ? count - 1 : current;
    }
    case "ArrowUp":
      return current - columns >= 0 ? current - columns : current;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Cartes entre deux positions de la liste, bornes comprises, dans l'ordre affiché. */
export function rangeIds(items: Pick<PrintingDTO, "id">[], from: number, to: number) {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(items.length - 1, Math.max(from, to));
  return items.slice(start, end + 1).map((item) => item.id);
}

/**
 * Sélection multiple au clavier, équivalent du Ctrl+glisser : un seul arrêt de tabulation dans la
 * grille (tabindex mobile), flèches pour se déplacer, et en mode sélection Espace coche la carte,
 * Maj+flèches étend la sélection depuis la dernière carte cochée, Échap quitte le mode.
 */
export function useKeyboardSelection({
  items,
  draft,
  setDraft,
  layoutRef,
  canSelect,
  onStart,
}: {
  items: PrintingDTO[];
  draft: Record<string, number>;
  setDraft: Dispatch<SetStateAction<Record<string, number>>>;
  layoutRef: MutableRefObject<CardGridLayout | null>;
  /** false en lecture seule : les flèches restent, sans mode sélection. */
  canSelect: boolean;
  /** Entrée en mode sélection (le mode ajout porte la sélection). */
  onStart: () => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  // Incrémenté quand le clavier déplace le focus : la grille fait défiler et focalise la carte.
  const [focusRequest, setFocusRequest] = useState(0);
  // Point de départ de Maj+flèches, et sélection telle qu'elle était à ce moment.
  const anchorRef = useRef<{ index: number; base: Record<string, number> } | null>(null);
  const active = canSelect && selecting;
  const current = items.length === 0 ? 0 : Math.min(focusIndex, items.length - 1);

  useEffect(() => {
    if (!active) return;
    function onKey(event: globalThis.KeyboardEvent) {
      // Une fenêtre ouverte garde Échap pour elle.
      if (event.key !== "Escape" || event.defaultPrevented || isModalOpen()) return;
      setSelecting(false);
      anchorRef.current = null;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  function moveTo(index: number) {
    setFocusIndex(index);
    setFocusRequest((value) => value + 1);
  }

  function start() {
    onStart();
    setSelecting(true);
    anchorRef.current = null;
    moveTo(current);
  }

  function stop() {
    setSelecting(false);
    anchorRef.current = null;
  }

  function toggleAt(index: number) {
    const id = items[index]?.id;
    if (!id) return;
    const next = { ...draft };
    if (next[id]) delete next[id];
    else next[id] = 1;
    setDraft(next);
    anchorRef.current = { index, base: next };
  }

  function onTileFocus(event: FocusEvent<HTMLElement>) {
    const tile = event.target instanceof Element ? event.target.closest("[data-card-id]") : null;
    const id = tile?.getAttribute("data-card-id");
    if (!id) return;
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1 && index !== focusIndex) setFocusIndex(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // Seulement depuis la carte elle-même, pas depuis ses boutons (favori, +1).
    if (!(event.target instanceof Element) || !event.target.matches("[data-card-id] > button")) return;
    if (canSelect && (event.key === "s" || event.key === "S")) {
      event.preventDefault();
      if (selecting) stop();
      else start();
      return;
    }
    if (active && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      toggleAt(current);
      return;
    }
    const next = neighborIndex(current, event.key, layoutRef.current?.cols ?? 1, items.length);
    if (next === null) return;
    event.preventDefault();
    if (active && event.shiftKey) {
      const anchor = anchorRef.current ?? { index: current, base: draft };
      anchorRef.current = anchor;
      const extended = { ...anchor.base };
      for (const id of rangeIds(items, anchor.index, next)) extended[id] ||= 1;
      setDraft(extended);
    }
    moveTo(next);
  }

  // Espace active un bouton au relâchement : sans ça, la carte serait aussi ouverte.
  function onKeyUp(event: KeyboardEvent<HTMLElement>) {
    if (active && event.key === " ") event.preventDefault();
  }

  return { selecting: active, start, stop, focusIndex: current, focusRequest, onTileFocus, onKeyDown, onKeyUp };
}
