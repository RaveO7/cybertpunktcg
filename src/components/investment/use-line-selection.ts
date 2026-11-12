"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { InvestmentLine, InvestmentPosition } from "@/lib/logic";

/** Sélection d'exemplaires dans le détail : résumé et courbe ne portent plus que sur eux. */
export type LineSelection = {
  itemIds: string[];
  /** Alt+clic : début d'une plage de lignes (clé de ligne), terminée par le clic suivant. */
  anchor: string | null;
  /**
   * Sélection en cours (Ctrl ou Alt maintenu, plage entamée) : toutes les lignes restent affichées.
   * Une fois terminée, le détail ne montre plus que les lignes sélectionnées.
   */
  open: boolean;
  /** Choix au toucher (cases du téléphone) : le détail garde toutes les lignes malgré la sélection. */
  showAll: boolean;
};

export const NO_SELECTION: LineSelection = { itemIds: [], anchor: null, open: false, showAll: false };

/** Ligne affichée du détail : une carte (tous ses achats) ou un achat d'une carte dépliée. */
export type DisplayRow = { key: string; itemIds: string[] };

/** Clic sur une ligne du tableau, avec les touches tenues. */
export type ClickInput = { rowKey: string; itemIds: string[]; ctrl: boolean; alt: boolean };

/** Lignes affichées dans l'ordre (cartes, puis achats des cartes dépliées) : sert aux plages Alt+clic. */
export function displayRows(positions: InvestmentPosition[], expanded: ReadonlySet<string>): DisplayRow[] {
  return positions.flatMap((position) => {
    const row = { key: position.printingId, itemIds: position.lines.map((line) => line.itemId) };
    if (!expanded.has(position.printingId) || position.lines.length < 2) return [row];
    return [row, ...position.lines.map((line) => ({ key: line.itemId, itemIds: [line.itemId] }))];
  });
}

/** Achats des lignes affichées entre deux lignes (bornes comprises), dans l'ordre du tableau. */
export function rowRangeIds(rows: DisplayRow[], anchorKey: string, endKey: string, endItemIds: string[]) {
  const start = rows.findIndex((row) => row.key === anchorKey);
  const end = rows.findIndex((row) => row.key === endKey);
  if (start < 0 || end < 0) return endItemIds;
  return rows.slice(Math.min(start, end), Math.max(start, end) + 1).flatMap((row) => row.itemIds);
}

/** Détail réduit aux lignes sélectionnées : sélection terminée, faite au clic (pas au toucher). */
export function isCollapsed(selection: LineSelection, selectedCount: number) {
  return selectedCount > 0 && !selection.open && !selection.showAll;
}

function addIds(current: string[], ids: string[]) {
  return [...new Set([...current, ...ids])];
}

/** Ajoute les achats d'une ligne à la sélection, ou les en retire s'ils y sont tous. */
function toggleIds(current: string[], ids: string[]) {
  return ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : addIds(current, ids);
}

/**
 * Clic dans le tableau (ordinateur), comme pour les cartes : clic = cette ligne seule (re-clic : désélection),
 * Ctrl+clic = ajouter / retirer, Alt+clic puis clic ou Alt+clic sur une autre ligne = toutes les lignes entre
 * les deux. Liste déjà réduite à la sélection (`collapsed`) : elle le reste (Ctrl+clic y retire une ligne).
 */
export function clickRow(selection: LineSelection, click: ClickInput, rows: DisplayRow[], collapsed: boolean): LineSelection {
  if (click.ctrl) {
    return {
      ...selection,
      itemIds: toggleIds(selection.itemIds, click.itemIds),
      anchor: null,
      open: collapsed ? selection.open : true,
    };
  }
  if (selection.anchor && selection.anchor !== click.rowKey) {
    return {
      ...selection,
      itemIds: addIds(selection.itemIds, rowRangeIds(rows, selection.anchor, click.rowKey, click.itemIds)),
      anchor: null,
      // Alt encore maintenu : la liste se réduit au relâchement.
      open: click.alt ? selection.open : false,
    };
  }
  if (click.alt) {
    return {
      ...selection,
      itemIds: addIds(selection.itemIds, click.itemIds),
      anchor: click.rowKey,
      open: collapsed ? selection.open : true,
    };
  }
  const same =
    selection.itemIds.length === click.itemIds.length && click.itemIds.every((id) => selection.itemIds.includes(id));
  return { ...NO_SELECTION, itemIds: same ? [] : click.itemIds };
}

/**
 * Toucher dans la liste (téléphone) : coche ou décoche la ligne, la liste reste entière.
 * Liste déjà réduite (sélection faite sur ordinateur) : elle le reste.
 */
export function touchRow(selection: LineSelection, itemIds: string[], collapsed: boolean): LineSelection {
  return {
    ...selection,
    itemIds: toggleIds(selection.itemIds, itemIds),
    anchor: null,
    showAll: collapsed ? selection.showAll : true,
  };
}

/**
 * Sélection d'exemplaires du détail. Un exemplaire écarté par les filtres n'est plus sélectionné :
 * `selectedLines` ne garde que les lignes de `filtered`.
 */
export function useLineSelection(filtered: InvestmentLine[]) {
  const [selection, setSelection] = useState<LineSelection>(NO_SELECTION);
  const selectedLines = useMemo(() => {
    const wanted = new Set(selection.itemIds);
    return filtered.filter((line) => wanted.has(line.itemId));
  }, [filtered, selection.itemIds]);
  const selectedItemIds = useMemo(() => new Set(selectedLines.map((line) => line.itemId)), [selectedLines]);
  const collapsed = isCollapsed(selection, selectedLines.length);
  // Stables : utilisables dans les effets de l'écran.
  const select = useCallback((itemIds: string[]) => setSelection({ ...NO_SELECTION, itemIds }), []);
  const clear = useCallback(() => setSelection(NO_SELECTION), []);

  // Ctrl / Alt relâché (ou fenêtre quittée) sans plage entamée : la sélection est terminée.
  useEffect(() => {
    if (!selection.open || selection.anchor) return;
    function finish(event: Event) {
      if (event instanceof KeyboardEvent && !["Control", "Meta", "Alt"].includes(event.key)) return;
      setSelection((current) => (current.open ? { ...current, open: false } : current));
    }
    window.addEventListener("keyup", finish);
    window.addEventListener("blur", finish);
    return () => {
      window.removeEventListener("keyup", finish);
      window.removeEventListener("blur", finish);
    };
  }, [selection.anchor, selection.open]);

  return {
    selectedLines,
    selectedItemIds,
    /** Le détail ne montre plus que les lignes sélectionnées. */
    collapsed,
    /** Ligne choisie par Alt+clic, en attente de la fin de plage. */
    rangeAnchor: selection.anchor,
    /** Remplace la sélection (carte passée par l'URL). */
    select,
    clear,
    /** Clic dans le tableau ; `rows` : lignes affichées, pour les plages Alt+clic. */
    onRowClick(event: MouseEvent, rowKey: string, itemIds: string[], rows: DisplayRow[]) {
      const ctrl = event.ctrlKey || event.metaKey || event.getModifierState("Control");
      const alt = event.altKey || event.getModifierState("Alt");
      if (ctrl || alt || (selection.anchor && selection.anchor !== rowKey)) event.preventDefault();
      setSelection((current) => clickRow(current, { rowKey, itemIds, ctrl, alt }, rows, collapsed));
    },
    /** Toucher dans la liste du téléphone. */
    onRowToggle: (itemIds: string[]) => setSelection((current) => touchRow(current, itemIds, collapsed)),
  };
}
