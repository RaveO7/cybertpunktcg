"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { cardIdsInBox, type CardGridLayout } from "@/components/VirtualCardGrid";
import type { PrintingDTO } from "@/lib/types";

/**
 * Sélection à la souris en mode ajout : Ctrl+clic bascule une carte, Ctrl+glisser trace un rectangle
 * qui inverse les cartes couvertes (la page défile près des bords), curseur en croix sous l'encart d'aide.
 */
export function useMarqueeSelection(
  effectiveAddMode: boolean,
  draft: Record<string, number>,
  filtered: PrintingDTO[],
  setDraft: Dispatch<SetStateAction<Record<string, number>>>,
) {

  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const ctrlHandled = useRef(false);
  const ctrlDown = useRef(false);
  const draftRef = useRef(draft);
  const gridLayoutRef = useRef<CardGridLayout | null>(null);
  const filteredRef = useRef<PrintingDTO[]>([]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  useEffect(() => {
    if (!effectiveAddMode) return;
    const drag = {
      startX: 0,
      startY: 0,
      pointerX: 0,
      pointerY: 0,
      moved: false,
      // Défilement au début du glisser : le point de départ reste accroché aux cartes.
      scrollStart: 0,
      base: {} as Record<string, number>,
    };
    let active = false;
    let scrollFrame = 0;

    const isCtrl = (event: MouseEvent | PointerEvent) =>
      event.ctrlKey || event.metaKey || event.getModifierState("Control") || ctrlDown.current;

    const scrollParent = () => {
      const grid = document.querySelector("[data-card-grid]");
      if (!(grid instanceof HTMLElement)) return null;
      let current = grid.parentElement;
      while (current) {
        const { overflowY } = getComputedStyle(current);
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return current;
        current = current.parentElement;
      }
      return null;
    };

    const scrollOffset = () => {
      const scroller = scrollParent();
      return scroller ? scroller.scrollTop : window.scrollY;
    };

    // Viewport coordinates — AppFrame scrolls <main>, not the window.
    // Le départ suit le contenu : après défilement il peut sortir de l'écran.
    const pageBox = () => {
      const x = drag.pointerX;
      const y = drag.pointerY;
      const startY = drag.startY - (scrollOffset() - drag.scrollStart);
      const left = Math.min(drag.startX, x);
      const top = Math.min(startY, y);
      const right = Math.max(drag.startX, x);
      const bottom = Math.max(startY, y);
      return { left, top, right, bottom };
    };

    const cardsInside = (box: { left: number; top: number; right: number; bottom: number }) => {
      const layout = gridLayoutRef.current;
      const grid = document.querySelector("[data-card-grid]");
      if (layout && grid) {
        // Origine relue ici : l'écouteur de scroll qui la met à jour peut passer après nous.
        const rect = grid.getBoundingClientRect();
        return cardIdsInBox(filteredRef.current, { ...layout, originX: rect.left, originY: rect.top }, box);
      }
      if (layout) return cardIdsInBox(filteredRef.current, layout, box);
      const ids: string[] = [];
      document.querySelectorAll("[data-card-id]").forEach((node) => {
        const rect = node.getBoundingClientRect();
        const hits =
          rect.left < box.right &&
          rect.right > box.left &&
          rect.top < box.bottom &&
          rect.bottom > box.top;
        if (!hits) return;
        const id = node.getAttribute("data-card-id");
        if (id) ids.push(id);
      });
      return ids;
    };

    const applySelection = () => {
      const box = pageBox();
      setMarquee({
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
      });
      const inside = cardsInside(box);
      // Inverse chaque carte couverte par rapport à l'état au début du glisser.
      setDraft(() => {
        const next = { ...drag.base };
        for (const id of inside) {
          if (drag.base[id]) delete next[id];
          else next[id] = 1;
        }
        return next;
      });
    };

    const edgeScroll = () => {
      const margin = 88;
      let delta = 0;
      if (drag.pointerY < margin) delta = -Math.ceil((margin - drag.pointerY) / 2 + 6);
      else if (drag.pointerY > window.innerHeight - margin) delta = Math.ceil((drag.pointerY - (window.innerHeight - margin)) / 2 + 6);
      if (delta === 0) return false;
      const scroller = scrollParent();
      if (scroller) scroller.scrollBy(0, delta);
      else window.scrollBy(0, delta);
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") ctrlDown.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") ctrlDown.current = false;
    };
    const onBlur = () => {
      ctrlDown.current = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !isCtrl(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-card-grid]") && !target.closest("[data-card-id]")) {
        // Espaces autour des cartes : compteur, marges latérales, gouttière avec les filtres.
        // N'importe où dans <main> (pied de page compris), hors contrôles interactifs.
        const main = document.querySelector("[data-card-zone]")?.closest("main");
        if (!main || !main.contains(target)) return;
        if (target.closest("a, button, input, select, textarea, label, summary, [role='button'], [contenteditable]")) return;
      }
      event.preventDefault();
      event.stopPropagation();
      active = true;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.pointerX = event.clientX;
      drag.pointerY = event.clientY;
      drag.moved = false;
      drag.scrollStart = scrollOffset();
      drag.base = { ...draftRef.current };
      ctrlHandled.current = true;
      const tick = () => {
        if (!active) return;
        if (drag.moved && edgeScroll()) applySelection();
        scrollFrame = window.requestAnimationFrame(tick);
      };
      scrollFrame = window.requestAnimationFrame(tick);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!active) return;
      drag.pointerX = event.clientX;
      drag.pointerY = event.clientY;
      const box = pageBox();
      if (box.right - box.left > 4 || box.bottom - box.top > 4) drag.moved = true;
      if (!drag.moved) return;
      event.preventDefault();
      applySelection();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!active) return;
      active = false;
      window.cancelAnimationFrame(scrollFrame);
      setMarquee(null);
      if (!drag.moved) {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const card = target instanceof Element ? target.closest("[data-card-id]") : null;
        const id = card?.getAttribute("data-card-id");
        if (id) {
          setDraft((current) => {
            const next = { ...current };
            if (next[id]) delete next[id];
            else next[id] = 1;
            return next;
          });
        }
      }
      ctrlHandled.current = true;
    };
    // Molette ou défilement tactile pendant le glisser : le rectangle s'étend avec la page.
    const onScroll = () => {
      if (active && drag.moved) applySelection();
    };
    const onClick = (event: MouseEvent) => {
      if (!ctrlHandled.current && !isCtrl(event)) return;
      event.preventDefault();
      event.stopPropagation();
      ctrlHandled.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("click", onClick, true);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [effectiveAddMode, setDraft]);

  // Curseur en croix dans <main> sous le bas de l'encart d'aide : voir main[data-add-mode] dans globals.css.
  useEffect(() => {
    if (!effectiveAddMode) return;
    const main = document.querySelector("main");
    if (!main) return;
    let pointerY: number | null = null;
    const refresh = () => {
      if (pointerY === null) return;
      const help = document.querySelector("[data-add-help]");
      const below = !help || pointerY > help.getBoundingClientRect().bottom;
      main.toggleAttribute("data-add-mode", below);
    };
    const onMove = (event: PointerEvent) => {
      pointerY = event.clientY;
      refresh();
    };
    main.addEventListener("pointermove", onMove);
    main.addEventListener("scroll", refresh, { passive: true });
    return () => {
      main.removeEventListener("pointermove", onMove);
      main.removeEventListener("scroll", refresh);
      main.removeAttribute("data-add-mode");
    };
  }, [effectiveAddMode]);

  return { marquee, setMarquee, ctrlHandledRef: ctrlHandled, ctrlDownRef: ctrlDown, gridLayoutRef };
}
