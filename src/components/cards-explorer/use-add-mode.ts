"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { useMarqueeSelection } from "@/components/cards-explorer/use-marquee-selection";
import { useKeyboardSelection } from "@/components/cards-explorer/use-keyboard-selection";
import { collectorRangeIds } from "@/lib/cards/sort";
import type { Filters, PrintingDTO } from "@/lib/types";

type AddModeOptions = {
  readOnly: boolean;
  filtered: PrintingDTO[];
  /** Condition proposée par défaut (réglages de l'utilisateur). */
  defaultCondition: string;
  update: (partial: Partial<Filters>) => void;
  openPrinting: (printingId: string) => void;
  saveBatch: (input: { conditionCode: string; lines: { printingId: string; quantity: number }[] }) => Promise<unknown>;
};

/**
 * Mode ajout de l'explorateur : sélection de cartes (clic, plage, Ctrl, rectangle, clavier), quantités en
 * attente (`draft`), feuille d'ajout rapide, confirmation de sortie et enregistrement du lot.
 */
export function useAddMode({ readOnly, filtered, defaultCondition, update, openPrinting, saveBatch }: AddModeOptions) {
  const t = useTranslations();
  const [addMode, setAddMode] = useState(false);
  const effectiveAddMode = readOnly ? false : addMode;
  const [addCondition, setAddCondition] = useState(defaultCondition);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  // Carte touchée en mode ajout : feuille pour choisir quantité, état, langue et version.
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  // État par défaut du mode ajout modifié dans les réglages : on suit, pendant le rendu.
  const [syncedAddCondition, setSyncedAddCondition] = useState(defaultCondition);
  if (defaultCondition !== syncedAddCondition) {
    setSyncedAddCondition(defaultCondition);
    setAddCondition(defaultCondition);
  }

  const { marquee, setMarquee, ctrlHandledRef, ctrlDownRef, gridLayoutRef } = useMarqueeSelection(
    effectiveAddMode,
    draft,
    filtered,
    setDraft,
  );

  function enterAddMode() {
    setAddMode(true);
    setAddError(null);
    update({ printingId: null });
  }

  const keyboard = useKeyboardSelection({
    items: filtered,
    draft,
    setDraft,
    layoutRef: gridLayoutRef,
    canSelect: !readOnly,
    onStart: () => {
      if (addMode) return;
      enterAddMode();
    },
  });

  useEffect(() => {
    if (!effectiveAddMode) return;
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      event.preventDefault();
      setDraft((current) => {
        const next = { ...current };
        for (const printing of filtered) {
          if (!next[printing.id]) next[printing.id] = 1;
        }
        return next;
      });
      setAddError(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effectiveAddMode, filtered]);

  function queueCard(id: string) {
    setDraft((current) => ({ ...current, [id]: Math.min(999, (current[id] ?? 0) + 1) }));
    setAddError(null);
  }

  function selectCards(ids: string[]) {
    setDraft((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (!next[id]) next[id] = 1;
      }
      return next;
    });
    setAddError(null);
  }

  function removeFromSelection(id: string) {
    setDraft((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setRangeAnchor((current) => (current === id ? null : current));
  }

  function toggleCard(id: string) {
    setDraft((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
    setRangeAnchor(null);
    setAddError(null);
  }

  function unqueueCard(id: string) {
    setDraft((current) => {
      const next = { ...current };
      const quantity = (next[id] ?? 0) - 1;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  }

  function selectAllFiltered() {
    selectCards(filtered.map((printing) => printing.id));
  }

  function clearSelection() {
    setDraft({});
    setRangeAnchor(null);
    setAddError(null);
  }

  function handleCardClick(event: MouseEvent, printingId: string) {
    if (!effectiveAddMode) {
      openPrinting(printingId);
      return;
    }
    if (keyboard.selecting && !ctrlHandledRef.current) {
      event.preventDefault();
      toggleCard(printingId);
      return;
    }
    if (ctrlHandledRef.current || event.ctrlKey || event.metaKey || event.getModifierState("Control") || ctrlDownRef.current) {
      event.preventDefault();
      if (!ctrlHandledRef.current) toggleCard(printingId);
      ctrlHandledRef.current = false;
      ctrlDownRef.current = event.ctrlKey || event.metaKey || event.getModifierState("Control");
      return;
    }
    const alt = event.altKey || event.getModifierState("Alt");
    if (rangeAnchor && rangeAnchor !== printingId) {
      event.preventDefault();
      selectCards(collectorRangeIds(filtered, rangeAnchor, printingId));
      setRangeAnchor(null);
      return;
    }
    if (alt) {
      event.preventDefault();
      setRangeAnchor(printingId);
      selectCards([printingId]);
      return;
    }
    setQuickAddId(printingId);
  }

  function exitAddMode() {
    keyboard.stop();
    setAddMode(false);
    setLeaveConfirm(false);
    setAddError(null);
    setRangeAnchor(null);
    setDraft({});
    setMarquee(null);
    setQuickAddId(null);
  }

  function requestExitAddMode() {
    if (Object.keys(draft).length > 0) {
      setLeaveConfirm(true);
      return;
    }
    exitAddMode();
  }

  async function commitDraft() {
    const lines = Object.entries(draft).map(([printingId, quantity]) => ({ printingId, quantity }));
    if (lines.length === 0) return;
    setAdding(true);
    setAddError(null);
    try {
      await saveBatch({ conditionCode: addCondition, lines });
      exitAddMode();
    } catch (commitError) {
      setAddError(commitError instanceof Error ? commitError.message : t("cards.addFailed"));
    } finally {
      setAdding(false);
    }
  }

  const draftCards = Object.keys(draft).length;
  const draftCopies = Object.values(draft).reduce((sum, quantity) => sum + quantity, 0);

  return {
    addMode,
    effectiveAddMode,
    addCondition,
    setAddCondition,
    draft,
    draftCards,
    draftCopies,
    rangeAnchor,
    adding,
    leaveConfirm,
    setLeaveConfirm,
    quickAddId,
    closeQuickAdd: () => setQuickAddId(null),
    addError,
    setAddError,
    marquee,
    keyboard,
    gridLayoutRef,
    enterAddMode,
    queueCard,
    unqueueCard,
    removeFromSelection,
    selectAllFiltered,
    clearSelection,
    handleCardClick,
    exitAddMode,
    requestExitAddMode,
    commitDraft,
  };
}
