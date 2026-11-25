"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { OverlaySkeleton } from "@/components/site/ScreenSkeleton";
import { usePreloadAfterLoad } from "@/components/use-preload-after-load";
import { useCollection } from "@/components/CollectionProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { FilterPanel } from "@/components/FilterPanel";
import { VirtualCardGrid } from "@/components/VirtualCardGrid";
import { AddModeHelp } from "@/components/cards-explorer/AddModeHelp";
import { FiltersDrawer } from "@/components/cards-explorer/FiltersDrawer";
import { LeaveAddModeDialog } from "@/components/cards-explorer/LeaveAddModeDialog";
import { isWideLayout, resolveOpenedPrinting } from "@/components/cards-explorer/list-helpers";
import { ResultSummary } from "@/components/cards-explorer/ResultSummary";
import { SelectionBar } from "@/components/cards-explorer/SelectionBar";
import { SortControl } from "@/components/cards-explorer/SortControl";
import { useAddMode } from "@/components/cards-explorer/use-add-mode";
import { useExplorerData } from "@/components/cards-explorer/use-explorer-data";
import { useExplorerFilters } from "@/components/cards-explorer/use-explorer-filters";
import { ownershipOf } from "@/lib/cards/collection-stats";
import { defaultFilters } from "@/lib/cards/filters";
import { printingsPriceTotal, selectionPriceTotal } from "@/lib/cards/pricing";
import { siblingPrintings } from "@/lib/cards/printings";
import { ALL_SETS_ID, isSealedSetCode } from "@/lib/reference-data";
import type { CatalogDTO, CollectionItemDTO } from "@/lib/types";
import { usePreferences } from "@/components/PreferencesProvider";

// Fenêtres chargées à leur première ouverture, pas avec la grille (premier chargement plus léger), puis
// préchargées au repos pour rester disponibles hors ligne (usePreloadAfterLoad).
const loadCardModal = () => import("@/components/CardModal").then((module) => module.CardModal);
const loadQuickAddSheet = () => import("@/components/QuickAddSheet").then((module) => module.QuickAddSheet);
const loadWindows = () => Promise.all([loadCardModal(), loadQuickAddSheet()]);
const CardModal = dynamic(loadCardModal, { loading: () => <OverlaySkeleton /> });
const QuickAddSheet = dynamic(loadQuickAddSheet, { loading: () => <OverlaySkeleton /> });

export function CardsExplorer({
  readOnly = false,
  catalog: catalogProp,
  items: itemsProp,
  syncBrowseSelection = true,
}: {
  readOnly?: boolean;
  catalog?: CatalogDTO | null;
  items?: CollectionItemDTO[];
  syncBrowseSelection?: boolean;
} = {}) {
  const {
    ready: collectionReady,
    error: collectionError,
    catalog: collectionCatalog,
    items: collectionItems,
    saveLine,
    saveBatch,
    patchLine,
    deleteLine,
    pendingIds,
  } = useCollection();
  const catalog = catalogProp ?? collectionCatalog;
  const items = itemsProp ?? collectionItems;
  const ready = catalogProp != null ? true : collectionReady;
  const error = catalogProp != null ? null : collectionError;
  const t = useTranslations();
  const { prefs } = usePreferences();
  usePreloadAfterLoad(loadWindows);
  const { filters, activeFilters, listFilters, filterDefaults, update, filterOnly, openPrinting, closePrinting } =
    useExplorerFilters(catalog, syncBrowseSelection);
  const [filtersVisibility, setFiltersVisibility] = useState<"auto" | "open" | "closed">(prefs.filtersPanel);
  // Tiroir de filtres sur téléphone/tablette, indépendant de la colonne de bureau.
  const [filtersDrawer, setFiltersDrawer] = useState(false);
  const wishlist = useWishlist();
  const favoriteIds = useMemo(
    () => new Map(wishlist.items.map((item) => [item.printingId, item.id])),
    [wishlist.items],
  );
  const { cardsById, agg, facets, setChoices, filtered, ownedIds } = useExplorerData(
    catalog,
    items,
    activeFilters,
    listFilters,
    filterDefaults.sort,
  );


  const {
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
    closeQuickAdd,
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
  } = useAddMode({
    readOnly,
    filtered,
    defaultCondition: prefs.condition,
    update,
    openPrinting,
    saveBatch,
  });

  // Prix de la liste filtrée : toujours en mode normal, et pour les cartes manquantes même en mode ajout.
  const missingList = activeFilters.collection === "missing";
  const listPrice = useMemo(
    () => ((missingList || !effectiveAddMode) && catalog?.hasPrices ? printingsPriceTotal(filtered) : null),
    [missingList, effectiveAddMode, catalog?.hasPrices, filtered],
  );
  const selectionPrice = useMemo(
    () => (draftCopies > 0 && catalog?.hasPrices ? selectionPriceTotal(catalog.printings, draft) : null),
    [catalog, draft, draftCopies],
  );

  const selected = resolveOpenedPrinting(catalog?.printings ?? [], filters.printingId);
  const selectedCard = selected ? cardsById.get(selected.cardId) : undefined;
  const selectedIndex = selected ? filtered.findIndex((printing) => printing.id === selected.id) : -1;
  const prevId = selectedIndex > 0 ? filtered[selectedIndex - 1]?.id ?? null : null;
  const nextId =
    selectedIndex >= 0 && selectedIndex < filtered.length - 1
      ? filtered[selectedIndex + 1]?.id ?? null
      : null;
  // Images des cartes voisines, préchargées pour que la navigation affiche l'illustration sans attendre.
  // Triées par distance : les plus proches d'abord (clics rapides sur « suivante »).
  const neighborImages = Array.from({ length: 16 }, (_, index) => (index % 2 ? 1 : -1) * (Math.floor(index / 2) + 1))
    .map((offset) => (selectedIndex >= 0 ? filtered[selectedIndex + offset]?.imagePath : null))
    .filter((src): src is string => Boolean(src));

  function openFilters() {
    if (isWideLayout()) setFiltersVisibility("open");
    else setFiltersDrawer(true);
  }

  function closeFilters() {
    if (filtersDrawer && !isWideLayout()) setFiltersDrawer(false);
    else setFiltersVisibility("closed");
  }

  function toggleFavorite(printingId: string) {
    const wishId = favoriteIds.get(printingId);
    const action = wishId ? wishlist.remove(wishId) : wishlist.save(printingId);
    action.catch((favoriteError: unknown) => {
      setAddError(favoriteError instanceof Error ? favoriteError.message : t("cards.favoriteFailed"));
    });
  }

  // Grille mémorisée : passer d'une fiche à l'autre ne la redessine pas (elle est sous la fiche).
  // Les gestionnaires passent par une ref pour rester à jour sans invalider la mémoïsation.
  const gridHandlers = {
    onCardClick: handleCardClick,
    onCardContextMenu: (event: React.MouseEvent, printingId: string) => {
      if (!effectiveAddMode) return;
      event.preventDefault();
      removeFromSelection(printingId);
    },
    onQueue: queueCard,
    onUnqueue: unqueueCard,
    onToggleFavorite: toggleFavorite,
    onTileFocus: keyboard.onTileFocus,
    onGridKeyDown: keyboard.onKeyDown,
    onGridKeyUp: keyboard.onKeyUp,
    onFiltersChange: update,
    onFiltersReset: () => update(defaultFilters(true, filterDefaults)),
    onFiltersClose: closeFilters,
  };
  const gridHandlersRef = useRef(gridHandlers);
  useLayoutEffect(() => {
    gridHandlersRef.current = gridHandlers;
  });
  const filtersCollapsed = filtersVisibility === "closed";
  const grid = useMemo(
    () => (
      <VirtualCardGrid
        items={filtered}
        cardsById={cardsById}
        ownership={(printingId) => ownershipOf(printingId, agg).qty}
        draft={draft}
        rangeAnchor={rangeAnchor}
        addMode={effectiveAddMode}
        filtersCollapsed={filtersCollapsed}
        layoutRef={gridLayoutRef}
        onCardClick={(event, printingId) => gridHandlersRef.current.onCardClick(event, printingId)}
        onCardContextMenu={(event, printingId) => gridHandlersRef.current.onCardContextMenu(event, printingId)}
        onQueue={(printingId) => gridHandlersRef.current.onQueue(printingId)}
        onUnqueue={(printingId) => gridHandlersRef.current.onUnqueue(printingId)}
        isFavorite={(printingId) => favoriteIds.has(printingId)}
        favoritesReady={wishlist.ready}
        onToggleFavorite={readOnly ? undefined : (printingId) => gridHandlersRef.current.onToggleFavorite(printingId)}
        focusIndex={keyboard.focusIndex}
        focusRequest={keyboard.focusRequest}
        selecting={keyboard.selecting}
        onTileFocus={(event) => gridHandlersRef.current.onTileFocus(event)}
        onGridKeyDown={(event) => gridHandlersRef.current.onGridKeyDown(event)}
        onGridKeyUp={(event) => gridHandlersRef.current.onGridKeyUp(event)}
      />
    ),
    [
      filtered,
      cardsById,
      agg,
      draft,
      rangeAnchor,
      effectiveAddMode,
      filtersCollapsed,
      gridLayoutRef,
      favoriteIds,
      wishlist.ready,
      readOnly,
      keyboard.focusIndex,
      keyboard.focusRequest,
      keyboard.selecting,
    ],
  );

  // Colonne de filtres : même principe, elle ne dépend pas de la fiche ouverte.
  const conditions = catalog?.conditions;
  const filterPanel = useMemo(
    () =>
      facets && conditions ? (
        <FilterPanel
          filters={listFilters}
          facets={facets}
          sets={setChoices}
          conditions={conditions}
          onChange={(partial) => gridHandlersRef.current.onFiltersChange(partial)}
          onReset={() => gridHandlersRef.current.onFiltersReset()}
          onClose={() => gridHandlersRef.current.onFiltersClose()}
        />
      ) : null,
    [listFilters, facets, setChoices, conditions],
  );

  const quickAddPrinting = effectiveAddMode ? resolveOpenedPrinting(catalog?.printings ?? [], quickAddId) : null;

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!ready || !catalog || !facets) return <p className="p-6 text-muted">{t("common.loading")}</p>;
  if (catalog.printings.length === 0) {
    return (
      <p className="p-6 text-sm text-muted">
        {t("investment.emptyCatalog")} <code className="text-cyan">npm run import:cards</code>.
      </p>
    );
  }

  return (
    <div
      className={`mx-auto grid w-full gap-6 py-4 ${
        filtersVisibility === "closed"
          ? "max-w-[80rem] px-4 md:px-8"
          : "max-w-[1600px] px-4 lg:grid-cols-[280px_1fr]"
      }`}
    >
      <FiltersDrawer
        open={filtersDrawer}
        collapsed={filtersVisibility === "closed"}
        resultCount={filtered.length}
        onClose={() => setFiltersDrawer(false)}
      >
        {filterPanel}
      </FiltersDrawer>
      <div>
        <div className="mb-4 flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3">
          <button
            type="button"
            aria-label={t("cards.filters")}
            aria-expanded={filtersDrawer}
            className={`grid h-10 w-10 shrink-0 place-items-center border border-line text-cyan sm:border-0 ${
              filtersVisibility === "closed" ? "" : "lg:hidden"
            }`}
            onClick={openFilters}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="square" />
            </svg>
          </button>
          <input
            value={activeFilters.q}
            onChange={(event) => update({ q: event.target.value, page: 1 })}
            placeholder={t("cards.searchPlaceholder")}
            aria-label={t("common.search")}
            type="search"
            enterKeyHint="search"
            className="h-10 min-w-0 flex-1 basis-[calc(100%-3rem)] border border-line-field bg-panel px-3 text-sm outline-none focus:border-cyan sm:basis-40"
          />
          <SortControl sort={activeFilters.sort} onChange={(sort) => update({ sort, page: 1 })} />
          {!readOnly ? (
            <button
              type="button"
              aria-pressed={addMode}
              className={`h-10 shrink-0 px-3 text-sm ${addMode ? "bg-yellow font-semibold text-black" : "border border-yellow text-yellow"}`}
              onClick={addMode ? requestExitAddMode : enterAddMode}
            >
              {t("cards.addMode")}
            </button>
          ) : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {keyboard.selecting ? t("cards.selectedCount", { n: draftCards }) : ""}
        </p>
        {effectiveAddMode ? (
          <AddModeHelp
            conditions={catalog.conditions}
            addCondition={addCondition}
            rangeStartNumber={
              rangeAnchor ? (filtered.find((printing) => printing.id === rangeAnchor)?.collectorNumber ?? "") : null
            }
            canSelectAll={filtered.length > 0}
            onConditionChange={setAddCondition}
            onSelectAll={selectAllFiltered}
            onClearSelection={clearSelection}
          />
        ) : null}
        <div data-card-zone="" className={effectiveAddMode ? "select-none" : undefined}>
        <ResultSummary count={filtered.length} listPrice={listPrice} missingList={missingList} selectionPrice={selectionPrice} />
        {filtered.length === 0 ? (
          <p className="border border-line px-4 py-10 text-center text-sm text-muted">{t("cards.noMatch")}</p>
        ) : (
          grid
        )}
        </div>
      </div>
      {selected && selectedCard ? (
        <CardModal
          printing={selected}
          card={selectedCard}
          siblings={siblingPrintings(catalog.printings, selected)}
          items={items.filter((item) => item.printingId === selected.id)}
          conditions={catalog.conditions}
          ownedIds={ownedIds}
          onOpen={(id) => update({ printingId: id })}
          onClose={closePrinting}
          prevId={prevId}
          nextId={nextId}
          preloadImages={neighborImages}
          onFilterArtist={(artist) =>
            update({ artists: [artist], set: ALL_SETS_ID, printingId: null, page: 1 })
          }
          onFilterRarity={(rarity) => filterOnly({ rarity })}
          onFilterSet={(set) => update({ set, printingId: null, page: 1 })}
          onFilter={filterOnly}
          readOnly={readOnly}
          onSave={readOnly ? undefined : (input) => saveLine({ ...input, printingId: selected.id, mode: "add" })}
          onPatch={readOnly ? undefined : patchLine}
          onDelete={readOnly ? undefined : deleteLine}
          pendingIds={readOnly ? undefined : pendingIds}
        />
      ) : null}
      {quickAddPrinting && catalog ? (
        <QuickAddSheet
          key={quickAddPrinting.id}
          printing={quickAddPrinting}
          card={cardsById.get(quickAddPrinting.cardId)}
          printings={catalog.printings.filter(
            (printing) => printing.cardId === quickAddPrinting.cardId && !isSealedSetCode(printing.setCode),
          )}
          conditions={catalog.conditions}
          defaultCondition={addCondition}
          onSave={(input) => saveLine({ ...input, mode: "add" })}
          onClose={closeQuickAdd}
        />
      ) : null}
      {leaveConfirm && !readOnly ? (
        <LeaveAddModeDialog cardCount={draftCards} onStay={() => setLeaveConfirm(false)} onLeave={exitAddMode} />
      ) : null}
      {marquee ? (
        <div
          className="pointer-events-none fixed z-50 border-2 border-yellow bg-yellow/15 shadow-[inset_0_0_0_1px_rgba(62,224,255,0.45)]"
          style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
        />
      ) : null}
      {effectiveAddMode ? (
        <SelectionBar
          filtersVisibility={filtersVisibility}
          draftCopies={draftCopies}
          draftCards={draftCards}
          addError={addError}
          rangeAnchor={rangeAnchor}
          adding={adding}
          onClear={clearSelection}
          onCommit={commitDraft}
        />
      ) : null}
    </div>
  );
}
