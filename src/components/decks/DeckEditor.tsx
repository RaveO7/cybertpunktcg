"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useRouter } from "@/i18n/navigation";
import { useCollection } from "@/components/CollectionProvider";
import { CardPreview } from "@/components/decks/CardPreview";
import { DEFAULT_FILTERS, DeckBrowser, type BrowserFilters } from "@/components/decks/DeckBrowser";
import { CostCurve } from "@/components/decks/deck-editor/CostCurve";
import { DeckCardList } from "@/components/decks/deck-editor/DeckCardList";
import { DeckOverview } from "@/components/decks/deck-editor/DeckOverview";
import { SaveIndicator } from "@/components/decks/deck-editor/SaveIndicator";
import { ExportPanel, ImportPanel } from "@/components/decks/TransferPanels";
import { ShareDeckPanel } from "@/components/decks/ShareDeckPanel";
import { ShortfallPanel } from "@/components/decks/ShortfallPanel";
import { useDeckCatalog, useDeckSaver } from "@/components/decks/hooks";
import { BackLink, DeleteDeckDialog, PencilIcon, buttonClass } from "@/components/decks/ui";
import {
  DECK_RULES,
  analyzeDeck,
  deckShortfall,
  isLegend,
  maxCopies,
  ownedCopiesByCard,
  type DeckEntry,
} from "@/lib/deck-rules";
import type { CardDTO, CatalogDTO, DeckDTO } from "@/lib/types";

type Pane = "deck" | "add";

/**
 * Éditeur : à gauche (bureau) les cartes à ajouter, qui défilent avec la page ; à droite le deck,
 * collé en haut. Sur écran tactile et téléphone, aucune zone ne défile dans une autre.
 */
export function DeckEditor({
  deck,
  catalog,
  onSaved,
  onDelete,
}: {
  deck: DeckDTO;
  catalog: CatalogDTO;
  onSaved: (deck: DeckDTO) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const router = useRouter();
  const { items } = useCollection();
  const index = useDeckCatalog(catalog);
  const owned = useMemo(() => ownedCopiesByCard(items, catalog.printings), [items, catalog.printings]);
  const [name, setName] = useState(deck.name);
  const [entries, setEntries] = useState<DeckEntry[]>(deck.cards);
  const [pane, setPane] = useState<Pane>(deck.cards.length > 0 ? "deck" : "add");
  const [panel, setPanel] = useState<"none" | "export" | "import" | "share">("none");
  const [filters, setFilters] = useState<BrowserFilters>(DEFAULT_FILTERS);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const saver = useDeckSaver(deck.id, onSaved);
  const browserRef = useRef<HTMLElement>(null);

  const analysis = useMemo(() => analyzeDeck(entries, index.cardsById), [entries, index.cardsById]);
  const allLines = useMemo(() => [...analysis.legends, ...analysis.main], [analysis]);
  const shortfall = useMemo(() => deckShortfall(allLines, index.printingsByCard, owned), [allLines, index.printingsByCard, owned]);
  const lineByCard = useMemo(() => new Map(shortfall.lines.map((line) => [line.card.id, line])), [shortfall]);
  const quantities = useMemo(() => new Map(entries.map((entry) => [entry.cardId, entry.quantity])), [entries]);

  function updateCards(next: DeckEntry[]) {
    setEntries(next);
    saver.queue({ cards: next });
  }

  function setQuantity(cardId: string, quantity: number) {
    const rest = entries.filter((entry) => entry.cardId !== cardId);
    updateCards(quantity > 0 ? [...rest, { cardId, quantity }] : rest);
  }

  /** Pourquoi une carte de plus est refusée (copies max, 3 Legends aux noms différents), ou null. */
  const blockReason = (card: CardDTO) => {
    const quantity = quantities.get(card.id) ?? 0;
    if (quantity >= maxCopies(card)) return isLegend(card) ? t("decks.reasonLegendCopy") : t("decks.reasonCopies");
    if (!isLegend(card)) return null;
    if (analysis.legendCount >= DECK_RULES.legends) return t("decks.reasonLegendFull");
    return analysis.legends.some((line) => line.card.name === card.name) ? t("decks.reasonLegendName", { name: card.name }) : null;
  };
  const canAdd = (card: CardDTO) => blockReason(card) === null;

  // Carte affichée en aperçu et liste dans laquelle on navigue (résultats de recherche ou deck).
  const [previewing, setPreviewing] = useState<{ cardId: string; list: string[] } | null>(null);
  const openPreview = (cardId: string, list: string[]) => setPreviewing({ cardId, list });
  const closePreview = useCallback(() => setPreviewing(null), []);
  const navigatePreview = useCallback((cardId: string) => setPreviewing((current) => current && { ...current, cardId }), []);
  const previewCard = previewing ? index.cardsById.get(previewing.cardId) : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const paneScroll = useRef<Partial<Record<Pane, number>>>({});
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  /** Change d'onglet (téléphone) en retrouvant la position de défilement propre à chaque onglet. */
  function switchPane(next: Pane) {
    if (next === pane) return;
    const scroller = rootRef.current?.closest("main");
    setPane(next);
    if (!scroller) return;
    paneScroll.current[pane] = scroller.scrollTop;
    // Première visite : on garde la barre d'onglets en haut de l'écran.
    const target = paneScroll.current[next] ?? Math.min(scroller.scrollTop, tabsRef.current?.offsetTop ?? 0);
    requestAnimationFrame(() => scroller.scrollTo({ top: target }));
  }

  /** Glissement horizontal sur téléphone : vers la gauche « Ajouter des cartes », vers la droite « Deck ». */
  function onTouchStart(event: React.TouchEvent) {
    swipeStart.current = null;
    if (event.touches.length !== 1 || window.matchMedia("(min-width: 1024px)").matches) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [role=dialog], [data-no-swipe]")) return;
    const touch = event.touches[0];
    // Les bords de l'écran restent au geste « retour » du système.
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    switchPane(dx < 0 ? "add" : "deck");
  }

  /** Emplacement de Legend vide : affiche les Legends dans la recherche. */
  function browseLegends() {
    setFilters({ ...DEFAULT_FILTERS, type: "Legend" });
    setPane("add");
    requestAnimationFrame(() => browserRef.current?.scrollIntoView({ block: "start" }));
  }

  function commitName() {
    const next = name.trim().slice(0, 60);
    if (!next) {
      setName(deck.name);
      return;
    }
    if (next !== name) setName(next);
    if (next !== deck.name) saver.queue({ name: next });
  }

  async function remove() {
    setDeleteError(null);
    try {
      await onDelete(deck.id);
      router.push("/decks");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("decks.failed"));
    }
  }

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4 px-3 pt-3 pb-8 sm:px-5 lg:pt-5"
      data-swipe-zone=""
      // Masque l'en-tête de la liste, rendu par la page (voir app/[locale]/decks/page.tsx).
      data-hides-page-header=""
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <BackLink />
          <SaveIndicator status={saver.status} error={saver.error} onRetry={() => void saver.retry()} />
          <span className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "import"}
              onClick={() => setPanel(panel === "import" ? "none" : "import")}
            >
              {t("decks.import")}
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "export"}
              onClick={() => setPanel(panel === "export" ? "none" : "export")}
            >
              {t("decks.export")}
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "share"}
              onClick={() => setPanel(panel === "share" ? "none" : "share")}
            >
              {t("decks.share")}
            </button>
            <button type="button" className={buttonClass} onClick={() => setConfirmDelete(true)}>
              {t("decks.delete")}
            </button>
            {confirmDelete ? (
              <DeleteDeckDialog
                name={name}
                onConfirm={() => {
                  setConfirmDelete(false);
                  void remove();
                }}
                onCancel={() => setConfirmDelete(false)}
              />
            ) : null}
          </span>
        </div>
        <label className="flex max-w-2xl flex-col gap-1.5">
          <span className="hud-label">{t("decks.name")}</span>
          <span className="flex items-center gap-2 border border-line bg-panel px-3 transition hover:border-muted focus-within:border-cyan">
            <input
              className="h-12 min-w-0 flex-1 bg-transparent text-xl text-yellow outline-none sm:text-2xl"
              value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <PencilIcon className="h-5 w-5 shrink-0 text-yellow/80" />
          </span>
        </label>
        {deleteError ? (
          <p role="alert" className="text-sm text-danger">
            {deleteError}
          </p>
        ) : null}
      </header>

      {panel === "export" ? <ExportPanel lines={allLines} onClose={() => setPanel("none")} /> : null}
      {panel === "share" ? <ShareDeckPanel deckId={deck.id} onClose={() => setPanel("none")} /> : null}
      {panel === "import" ? (
        <ImportPanel
          cards={catalog.cards}
          onApply={(next) => {
            updateCards(next);
            setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {/* Téléphone / tablette : un onglet à la fois, barre d'onglets collée en haut. */}
      <div ref={tabsRef} className="sticky top-0 z-20 -mx-3 bg-background px-3 py-2 sm:-mx-5 sm:px-5 lg:hidden">
        <div className="flex border border-line" role="tablist" aria-label={t("decks.title")}>
          {(["deck", "add"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={pane === key}
              className={`flex h-11 flex-1 items-center justify-center gap-2 text-sm ${pane === key ? "bg-yellow text-black" : "text-muted"}`}
              onClick={() => switchPane(key)}
            >
              {key === "deck" ? (
                <>
                  {t("decks.deckTab")}
                  <span className="font-mono tabular-nums">
                    {fmt.int(analysis.legendCount + analysis.mainCount)}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${analysis.valid ? "bg-gain" : "bg-danger"}`} aria-hidden="true" />
                </>
              ) : (
                t("decks.addCards")
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section
          ref={browserRef}
          aria-labelledby="deck-picker"
          // Onglet masqué : invisible mais toujours mis en page (pas de display: none), sinon la grille
          // virtualisée mesure ses rangées à 0 px et perd sa hauteur (et la position de défilement).
          className={`${
            pane === "add" ? "deck-pane-from-right" : "pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
          } min-w-0 scroll-mt-16 lg:pointer-events-auto lg:visible lg:static lg:h-auto lg:overflow-visible lg:scroll-mt-0`}
        >
          <DeckBrowser
            pool={index.pool}
            extensions={index.extensions}
            filters={filters}
            onFilters={setFilters}
            analysis={analysis}
            quantities={quantities}
            owned={owned}
            preview={index.preview}
            canAdd={canAdd}
            onQuantity={setQuantity}
            onPreview={openPreview}
          />
        </section>
        <aside
          aria-label={t("decks.deckTab")}
          className={`${pane === "deck" ? "flex" : "hidden"} deck-pane-from-left scrollbar-hud min-w-0 flex-col gap-4 lg:flex lg:pointer-fine:sticky lg:pointer-fine:top-0 lg:pointer-fine:max-h-[100cqh] lg:pointer-fine:overflow-y-auto lg:pointer-fine:py-5 lg:pointer-fine:pr-1`}
        >
          <DeckOverview
            analysis={analysis}
            preview={index.preview}
            onQuantity={setQuantity}
            onBrowseLegends={browseLegends}
            onPreview={openPreview}
          />
          <DeckCardList
            analysis={analysis}
            lineByCard={lineByCard}
            canAdd={canAdd}
            onQuantity={setQuantity}
            onBrowse={() => switchPane("add")}
            onPreview={openPreview}
          />
          {analysis.mainCount > 0 ? <CostCurve curve={analysis.curve} /> : null}
          <ShortfallPanel shortfall={shortfall} printingsByCard={index.printingsByCard} />
        </aside>
      </div>

      {previewing && previewCard ? (
        <CardPreview
          card={previewCard}
          list={previewing.list}
          index={index}
          quantity={quantities.get(previewCard.id) ?? 0}
          owned={owned.get(previewCard.id) ?? 0}
          analysis={analysis}
          blockReason={blockReason(previewCard)}
          onNavigate={navigatePreview}
          onQuantity={setQuantity}
          onClose={closePreview}
        />
      ) : null}
    </div>
  );
}
