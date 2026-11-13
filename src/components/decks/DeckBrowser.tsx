"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CardImage } from "@/components/CardImage";
import { colorDotClass } from "@/components/CardTile";
import { CardFacts, Stepper } from "@/components/decks/ui";
import { cardLabel, isLegend, OTHER_EXTENSION, ramAllowed, type DeckAnalysis } from "@/lib/deck-rules";
import { cardSearchEntry, rankBySearch, searchScore } from "@/lib/logic";
import { BLOCKS, COLOR_ORDER, TYPE_ORDER } from "@/lib/reference-data";
import type { CardDTO, PrintingDTO } from "@/lib/types";

export type BrowserFilters = {
  query: string;
  /** Nom d'un bloc de BLOCKS, OTHER_EXTENSION ou "" (toutes). */
  extension: string;
  colors: string[];
  type: string;
  ownedOnly: boolean;
  ramOnly: boolean;
};

export const DEFAULT_FILTERS: BrowserFilters = { query: "", extension: "", colors: [], type: "", ownedOnly: false, ramOnly: true };

/** Cartes à ajouter : barre de filtres (collée en haut sur bureau) et grille d'images qui défile avec la page. */
export function DeckBrowser({
  pool,
  extensions,
  filters,
  onFilters,
  analysis,
  quantities,
  owned,
  preview,
  canAdd,
  onQuantity,
  onPreview,
}: {
  pool: CardDTO[];
  extensions: Map<string, Set<string>>;
  filters: BrowserFilters;
  onFilters: (filters: BrowserFilters) => void;
  analysis: DeckAnalysis;
  quantities: Map<string, number>;
  owned: Map<string, number>;
  preview: Map<string, PrintingDTO>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onPreview: (cardId: string, list: string[]) => void;
}) {
  const t = useTranslations();
  // Extensions proposées : celles des cartes jouables, dans l'ordre de BLOCKS, « Autres » en dernier.
  const extensionOptions = useMemo(() => {
    const present = new Set(pool.flatMap((card) => [...(extensions.get(card.id) ?? [])]));
    return [...BLOCKS.map((block) => block.name), OTHER_EXTENSION].filter((name) => present.has(name));
  }, [pool, extensions]);
  const hasLegends = analysis.legends.length > 0;
  // Même recherche que l'explorateur (fautes tolérées, pertinence) ; le filtrage suit la saisie sans la bloquer.
  const query = useDeferredValue(filters.query);
  const matched = pool.filter((card) => {
    if (query.trim() && searchScore(cardSearchEntry(card), query) === null) return false;
    if (filters.colors.length > 0 && !filters.colors.includes(card.color ?? "")) return false;
    if (filters.extension && !extensions.get(card.id)?.has(filters.extension)) return false;
    if (filters.type && card.cardType !== filters.type) return false;
    if (filters.ownedOnly && !(owned.get(card.id) ?? 0)) return false;
    if (filters.ramOnly && hasLegends && !isLegend(card) && !ramAllowed(card, analysis.ramLimits)) return false;
    return true;
  });
  const results = rankBySearch(matched, query, cardSearchEntry);
  const update = (patch: Partial<BrowserFilters>) => onFilters({ ...filters, ...patch });
  const chip = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 border px-2.5 text-xs transition ${
      active ? "border-cyan bg-cyan/10 text-foreground" : "border-line text-muted hover:border-muted hover:text-foreground"
    }`;

  return (
    <>
      <div className="flex flex-col gap-2.5 border-b border-line bg-background pb-3 lg:sticky lg:top-0 lg:z-10 lg:pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="deck-picker" className="sr-only">
            {t("decks.addCards")}
          </h2>
          <input
            type="search"
            className="h-11 min-w-0 flex-1 basis-56 border border-line bg-panel px-3 text-sm outline-none focus:border-cyan"
            placeholder={t("decks.searchPlaceholder")}
            aria-label={t("common.search")}
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
          />
          <label className="flex h-11 min-w-0 flex-1 basis-48 items-center border border-line bg-panel focus-within:border-cyan sm:flex-none">
            <span className="shrink-0 pl-3 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">{t("decks.extension")}</span>
            <select
              className="h-full min-w-0 flex-1 cursor-pointer bg-transparent px-2 text-sm outline-none"
              value={filters.extension}
              onChange={(event) => update({ extension: event.target.value })}
            >
              <option value="">{t("decks.allExtensions")}</option>
              {extensionOptions.map((name) => (
                <option key={name} value={name}>
                  {name === OTHER_EXTENSION ? t("decks.otherExtensions") : name}
                </option>
              ))}
            </select>
          </label>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted" aria-live="polite">
            {t("decks.resultCount", { n: results.length })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_ORDER.map((color) => {
            const active = filters.colors.includes(color);
            return (
              <button
                key={color}
                type="button"
                aria-pressed={active}
                className={chip(active)}
                onClick={() => update({ colors: active ? filters.colors.filter((entry) => entry !== color) : [...filters.colors, color] })}
              >
                <span className={`h-2 w-2 rounded-full ${colorDotClass(color)}`} aria-hidden="true" />
                {color}
              </button>
            );
          })}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          {TYPE_ORDER.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={filters.type === entry}
              className={chip(filters.type === entry)}
              onClick={() => update({ type: filters.type === entry ? "" : entry })}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <label className="inline-flex min-h-8 items-center gap-2">
            <input type="checkbox" checked={filters.ownedOnly} onChange={(event) => update({ ownedOnly: event.target.checked })} />
            {t("decks.ownedOnly")}
          </label>
          <label className="inline-flex min-h-8 items-center gap-2" title={hasLegends ? undefined : t("decks.noRam")}>
            <input type="checkbox" checked={filters.ramOnly} onChange={(event) => update({ ramOnly: event.target.checked })} />
            {t("decks.ramOnly")}
          </label>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-8 text-sm text-muted">{t("decks.noResults")}</p>
      ) : (
        <VirtualTileGrid
          cards={results}
          renderTile={(card) => (
            <PickerTile
              key={card.id}
              card={card}
              printing={preview.get(card.id)}
              quantity={quantities.get(card.id) ?? 0}
              owned={owned.get(card.id) ?? 0}
              ramOk={isLegend(card) || !hasLegends || ramAllowed(card, analysis.ramLimits)}
              canAdd={canAdd(card)}
              onQuantity={onQuantity}
              onPreview={() => onPreview(card.id, results.map((entry) => entry.id))}
            />
          )}
        />
      )}
    </>
  );
}

/** Carte de la recherche, en grand : un clic sur l'image ajoute un exemplaire. */
function PickerTile({
  card,
  printing,
  quantity,
  owned,
  ramOk,
  canAdd,
  onQuantity,
  onPreview,
}: {
  card: CardDTO;
  printing: PrintingDTO | undefined;
  quantity: number;
  owned: number;
  ramOk: boolean;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onPreview: () => void;
}) {
  const t = useTranslations();
  const label = cardLabel(card);
  return (
    <div role="listitem" className="flex min-w-0 flex-col gap-1.5">
      {/* L'image ouvre l'aperçu (texte de la carte) ; les boutons − / + ajoutent sans l'ouvrir. */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={t("decks.viewCard", { name: label })}
        className={`group relative block w-full cursor-zoom-in rounded-lg ring-2 transition focus-visible:outline-none focus-visible:ring-cyan ${
          quantity ? "ring-cyan" : "ring-transparent hover:ring-line"
        }`}
      >
        {printing?.imagePath ? (
          <CardImage
            src={printing.imagePath}
            alt=""
            loading="lazy"
            className={`aspect-[63/88] w-full rounded-lg bg-black object-contain ${canAdd || quantity ? "" : "opacity-40"}`}
          />
        ) : (
          <span className="grid aspect-[63/88] w-full place-items-center rounded-lg bg-black text-xs text-muted">N/A</span>
        )}
        {quantity ? (
          <span className="absolute top-2 right-2 bg-cyan px-1.5 py-0.5 font-mono text-xs font-semibold text-black">×{quantity}</span>
        ) : null}
        {owned > 0 ? (
          <span className="absolute top-2 left-2 bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-gain">✓ {owned}</span>
        ) : null}
      </button>
      <span className="line-clamp-2 min-h-[2.5em] text-xs leading-tight" title={label}>
        {label}
      </span>
      <CardFacts card={card} ramOk={ramOk} />
      {owned > 0 ? <span className="sr-only">{t("decks.ownedCount", { n: owned })}</span> : null}
      <Stepper card={card} quantity={quantity} canAdd={canAdd} onQuantity={onQuantity} wide />
    </div>
  );
}

const TILE_MIN_WIDTH = 160;
const TILE_GAP_X = 12;
const TILE_GAP_Y = 16;
/** Hauteur sous l'image : nom (2 lignes), coût/RAM, boutons − / + et espacements. */
const TILE_META_HEIGHT = 112;

function scrollParentOf(node: HTMLElement) {
  let current = node.parentElement;
  while (current) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(current).overflowY)) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Grille virtualisée : toutes les cartes filtrées, mais seules les rangées proches de l'écran
 * sont rendues. Elle suit le défilement de la page (pas de zone de défilement imbriquée).
 */
function VirtualTileGrid({ cards, renderTile }: { cards: CardDTO[]; renderTile: (card: CardDTO) => React.ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  const cols = width < 640 ? 2 : Math.max(2, Math.floor((width + TILE_GAP_X) / (TILE_MIN_WIDTH + TILE_GAP_X)));
  const colWidth = width > 0 ? (width - TILE_GAP_X * (cols - 1)) / cols : TILE_MIN_WIDTH;
  const rowHeight = Math.ceil((colWidth * 88) / 63 + TILE_META_HEIGHT + TILE_GAP_Y);
  const rowCount = Math.ceil(cards.length / cols);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const parent = scrollParentOf(node);
    setScrollElement(parent);
    const update = () => {
      // Onglet masqué (téléphone) : on garde la dernière mesure pour ne pas perdre la hauteur de la grille.
      if (node.clientWidth === 0) return;
      setWidth(node.clientWidth);
      // Position de la grille dans la zone qui défile (change si un panneau s'ouvre au-dessus).
      const margin = parent
        ? Math.round(parent.scrollTop + node.getBoundingClientRect().top - parent.getBoundingClientRect().top)
        : 0;
      setScrollMargin((current) => (current === margin ? current : margin));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    if (parent?.firstElementChild) observer.observe(parent.firstElementChild);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
    useFlushSync: false,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, cols, virtualizer]);

  return (
    <div ref={listRef} role="list" className="relative mt-4" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          role="presentation"
          className="absolute left-0 grid w-full"
          style={{
            top: `${row.start - scrollMargin}px`,
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            columnGap: TILE_GAP_X,
            paddingBottom: TILE_GAP_Y,
          }}
        >
          {cards.slice(row.index * cols, row.index * cols + cols).map(renderTile)}
        </div>
      ))}
    </div>
  );
}
