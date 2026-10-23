"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { CardModal } from "@/components/CardModal";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { useCollection } from "@/components/CollectionProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { FilterPanel } from "@/components/FilterPanel";
import { VirtualCardGrid } from "@/components/VirtualCardGrid";
import { SelectionBar } from "@/components/cards-explorer/SelectionBar";
import { useMarqueeSelection } from "@/components/cards-explorer/use-marquee-selection";
import { useKeyboardSelection } from "@/components/cards-explorer/use-keyboard-selection";
import { useModal } from "@/components/use-modal";

import {
  aggregateCollection,
  alignReleasedFilters,
  browseChecklist,
  languageOptions,
  setForLanguage,
  buildFacets,
  defaultFilters,
  filterPrintings,
  ownershipOf,
  printingsPriceTotal,
  selectionPriceTotal,
  parseFilters,
  sealedBrowseFilters,
  serializeFilters,
  sortPrintings,
} from "@/lib/logic";
import {
  ALL_SETS_ID,
  BETA_SET_CODE,
  FRENCH_SOURCE_SET_CODE,
  isSealedSetCode,
  MAIN_SET_CODE,
  parseSetList,
} from "@/lib/reference-data";
import type { CatalogDTO, CollectionItemDTO, Filters, PrintingDTO } from "@/lib/types";
import { usePreferences } from "@/components/PreferencesProvider";
import { conditionOptionLabel } from "@/lib/condition-label";
import type { Translator } from "@/i18n/translator";
import { filterDefaultsFrom } from "@/lib/preferences";

function collectorRank(value: string) {
  const beta = /^β/i.test(value) ? 1 : 0;
  const body = value.replace(/^β/i, "");
  const match = body.match(/^0*(\d+)(.*)$/i);
  return {
    beta,
    number: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
    suffix: (match?.[2] ?? "").toLowerCase(),
  };
}

function compareCollector(left: ReturnType<typeof collectorRank>, right: ReturnType<typeof collectorRank>) {
  if (left.beta !== right.beta) return left.beta - right.beta;
  if (left.number !== right.number) return left.number - right.number;
  if (left.suffix === right.suffix) return 0;
  return left.suffix < right.suffix ? -1 : 1;
}

function collectorRangeIds(list: PrintingDTO[], anchorId: string, endId: string) {
  const anchor = list.find((printing) => printing.id === anchorId);
  const end = list.find((printing) => printing.id === endId);
  if (!anchor || !end) return [];
  const start = collectorRank(anchor.collectorNumber);
  const finish = collectorRank(end.collectorNumber);
  const low = compareCollector(start, finish) <= 0 ? start : finish;
  const high = compareCollector(start, finish) <= 0 ? finish : start;
  const beta = start.beta === finish.beta ? start.beta : null;
  return list
    .filter((printing) => {
      const rank = collectorRank(printing.collectorNumber);
      if (beta !== null && rank.beta !== beta) return false;
      return compareCollector(rank, low) >= 0 && compareCollector(rank, high) <= 0;
    })
    .map((printing) => printing.id);
}

function resolveOpenedPrinting(printings: PrintingDTO[], printingId: string | null) {
  if (!printingId) return null;
  return printings.find((item) => item.id === printingId) ?? null;
}

const WELCOME_ORDER = [BETA_SET_CODE, MAIN_SET_CODE];

/** Même seuil que `lg:` : au-dessus, les filtres sont une colonne ; en dessous, un tiroir. */
function isWideLayout() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

type SortDirection = "asc" | "desc";

/** Critère de tri affiché dans le menu ; le sens se choisit avec la flèche à côté. */
type SortField = {
  id: string;
  label: string;
  /** Clé de tri par sens ; une seule entrée quand le critère n'a pas de sens. */
  keys: { asc: Filters["sort"]; desc?: Filters["sort"] };
};

function sortFields(t: Translator): SortField[] {
  return [
    { id: "default", label: t("cards.sortDefault"), keys: { asc: "default" } },
    { id: "number", label: t("cards.sortFieldNumber"), keys: { asc: "number-asc", desc: "number-desc" } },
    { id: "cost", label: t("cards.sortFieldCost"), keys: { asc: "cost-asc", desc: "cost-desc" } },
    { id: "qty", label: t("cards.sortFieldQty"), keys: { asc: "qty-asc", desc: "qty-desc" } },
    { id: "name", label: t("cards.sortFieldName"), keys: { asc: "name-asc", desc: "name-desc" } },
    { id: "owned", label: t("cards.sortFieldOwned"), keys: { asc: "missing-first", desc: "owned-first" } },
    { id: "rarity", label: t("cards.sortRarity"), keys: { asc: "rarity" } },
    { id: "set", label: t("cards.groupSet"), keys: { asc: "set" } },
  ];
}

function splitSort(fields: SortField[], sort: Filters["sort"]): { field: SortField; dir: SortDirection } {
  for (const field of fields) {
    if (field.keys.asc === sort) return { field, dir: "asc" };
    if (field.keys.desc === sort) return { field, dir: "desc" };
  }
  return { field: fields[0], dir: "asc" };
}

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
  const fmt = useNumberFormat();
  const searchParams = useSearchParams();
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
  const { setCardsLocation } = useBrowseSelection();
  const t = useTranslations();
  const { prefs } = usePreferences();
  const filterDefaults = useMemo(() => filterDefaultsFrom(prefs), [prefs.collection, prefs.sort]);
  const SORT_FIELDS = sortFields(t);
  const [filters, setFilters] = useState<Filters>(() => parseFilters(searchParams, true, filterDefaultsFrom(prefs)));
  const [filtersVisibility, setFiltersVisibility] = useState<"auto" | "open" | "closed">(prefs.filtersPanel);
  // Tiroir de filtres sur téléphone/tablette, indépendant de la colonne de bureau.
  const [filtersDrawer, setFiltersDrawer] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const effectiveAddMode = readOnly ? false : addMode;
  const [addCondition, setAddCondition] = useState(prefs.condition);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  // Carte touchée en mode ajout : feuille pour choisir quantité, état, langue et version.
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const urlSyncRef = useRef(searchParams.toString());
  // Ouvrir une carte ajoute une entrée d'historique : le bouton retour (Android, geste iOS) la ferme.
  const pushUrlRef = useRef(false);
  const openedWithPushRef = useRef(false);
  // État par défaut du mode ajout modifié dans les réglages : on suit, pendant le rendu.
  const [syncedAddCondition, setSyncedAddCondition] = useState(prefs.condition);
  if (prefs.condition !== syncedAddCondition) {
    setSyncedAddCondition(prefs.condition);
    setAddCondition(prefs.condition);
  }
  useEffect(() => {
    const key = searchParams.toString();
    if (key === urlSyncRef.current) return;
    urlSyncRef.current = key;
    setFilters(parseFilters(new URLSearchParams(key), true, filterDefaults));
  }, [searchParams, filterDefaults]);
  const [addError, setAddError] = useState<string | null>(null);
  const wishlist = useWishlist();
  const favoriteIds = useMemo(
    () => new Map(wishlist.items.map((item) => [item.printingId, item.id])),
    [wishlist.items],
  );

  const cardsById = useMemo(() => new Map(catalog?.cards.map((card) => [card.id, card]) ?? []), [catalog]);
  const setsByCode = useMemo(() => new Map(catalog?.sets.map((set) => [set.code, set]) ?? []), [catalog]);
  const activeFilters = useMemo(() => alignReleasedFilters(filters), [filters]);
  // Each printing keeps its own ownership: a beta copy must not mark the retail card as owned.
  const agg = useMemo(() => aggregateCollection(items), [items]);

  useEffect(() => {
    const params = serializeFilters(activeFilters, true, filterDefaults);
    const query = params.toString();
    // Page affichée, dans sa langue (« /de/explorer », « /classeur/…/cartes ») : seule la query change.
    const base = window.location.pathname;
    const nextUrl = query ? `${base}?${query}` : base;
    urlSyncRef.current = query;
    if (syncBrowseSelection) {
      setCardsLocation({ set: activeFilters.set, language: activeFilters.language }, query);
    }
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const push = pushUrlRef.current;
    pushUrlRef.current = false;
    if (!activeFilters.printingId) openedWithPushRef.current = false;
    if (currentUrl !== nextUrl) {
      if (push) {
        window.history.pushState(null, "", nextUrl);
        openedWithPushRef.current = true;
      } else {
        // Preserve Next history state so App Router does not ACTION_RESTORE.
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    }
  }, [activeFilters, filterDefaults, setCardsLocation, syncBrowseSelection]);

  const drawerRef = useRef<HTMLDivElement>(null);
  useModal(drawerRef, { open: filtersDrawer, onClose: () => setFiltersDrawer(false) });
  const leaveRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  useModal(leaveRef, { open: leaveConfirm && !readOnly, onClose: () => setLeaveConfirm(false), initialFocus: stayRef });
  const setPrintings = useMemo(() => {
    if (!catalog) return [];
    if (activeFilters.set === ALL_SETS_ID) {
      return catalog.printings.filter((printing) => !isSealedSetCode(printing.setCode));
    }
    const checklist = browseChecklist(catalog.printings, activeFilters.set);
    if (checklist) return checklist;
    const codes = new Set(parseSetList(activeFilters.set));
    return catalog.printings.filter((printing) => codes.has(printing.setCode));
  }, [activeFilters.set, catalog]);
  const facets = useMemo(() => {
    if (!catalog) return null;
    const built = buildFacets(setPrintings, cardsById);
    return {
      ...built,
      languages: languageOptions(activeFilters.set, catalog.printings, built.languages),
    };
  }, [activeFilters.set, catalog, cardsById, setPrintings]);
  const setChoices = useMemo(() => {
    if (!catalog) return [];
    return catalog.sets
      .filter((set) => set.code !== FRENCH_SOURCE_SET_CODE)
      .sort((a, b) => {
        const aSealed = isSealedSetCode(a.code) ? 1 : 0;
        const bSealed = isSealedSetCode(b.code) ? 1 : 0;
        if (aSealed !== bSealed) return aSealed - bSealed;
        const aWelcome = WELCOME_ORDER.indexOf(a.code);
        const bWelcome = WELCOME_ORDER.indexOf(b.code);
        const aRank = aWelcome === -1 ? WELCOME_ORDER.length + a.sortOrder : aWelcome;
        const bRank = bWelcome === -1 ? WELCOME_ORDER.length + b.sortOrder : bWelcome;
        return aRank - bRank;
      });
  }, [catalog]);

  // La saisie s'affiche tout de suite ; le filtrage du catalogue suit sans bloquer la frappe.
  const deferredQuery = useDeferredValue(activeFilters.q);
  const filtered = useMemo(() => {
    if (!catalog) return [];
    const searchFilters = deferredQuery === activeFilters.q ? activeFilters : { ...activeFilters, q: deferredQuery };
    const matched = filterPrintings(
      catalog.printings,
      cardsById,
      agg,
      searchFilters,
      browseChecklist(catalog.printings, searchFilters.set),
    );
    return sortPrintings(matched, cardsById, agg, setsByCode, searchFilters.sort, {
      q: searchFilters.q,
      defaultSort: filterDefaults.sort,
    });
  }, [catalog, cardsById, agg, activeFilters, deferredQuery, setsByCode, filterDefaults.sort]);

  // Prix de la liste filtrée : toujours en mode normal, et pour les cartes manquantes même en mode ajout.
  const missingList = activeFilters.collection === "missing";
  const listPrice = useMemo(
    () => ((missingList || !effectiveAddMode) && catalog?.hasPrices ? printingsPriceTotal(filtered) : null),
    [missingList, effectiveAddMode, catalog?.hasPrices, filtered],
  );

  const { marquee, setMarquee, ctrlHandledRef, ctrlDownRef, gridLayoutRef } = useMarqueeSelection(
    effectiveAddMode,
    draft,
    filtered,
    setDraft,
  );

  const keyboard = useKeyboardSelection({
    items: filtered,
    draft,
    setDraft,
    layoutRef: gridLayoutRef,
    canSelect: !readOnly,
    onStart: () => {
      if (addMode) return;
      setAddMode(true);
      setAddError(null);
      update({ printingId: null });
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

  const selected = resolveOpenedPrinting(catalog?.printings ?? [], filters.printingId);
  const selectedCard = selected ? cardsById.get(selected.cardId) : undefined;
  const selectedIndex = selected ? filtered.findIndex((printing) => printing.id === selected.id) : -1;
  const prevId = selectedIndex > 0 ? filtered[selectedIndex - 1]?.id ?? null : null;
  const nextId =
    selectedIndex >= 0 && selectedIndex < filtered.length - 1
      ? filtered[selectedIndex + 1]?.id ?? null
      : null;
  // The modal lists each printing separately, beta and retail included.
  const ownedIds = useMemo(
    () => new Set(items.filter((item) => item.quantity > 0).map((item) => item.printingId)),
    [items],
  );

  function update(partial: Partial<Filters>) {
    setFilters((current) => {
      const enteringSealed =
        partial.set != null && isSealedSetCode(partial.set) && !isSealedSetCode(current.set);
      const base = enteringSealed
        ? sealedBrowseFilters(partial.set!, { language: current.language })
        : current;
      const merged = { ...base, ...partial };
      if (partial.set && isSealedSetCode(partial.set)) {
        merged.colors = [];
        merged.types = [];
        merged.tags = [];
        merged.keywords = [];
        merged.costs = [];
        merged.powers = [];
        merged.rams = [];
        merged.artists = [];
        merged.eddiable = "";
        merged.rarity = "";
      }
      if (partial.language != null && partial.language !== current.language && catalog) {
        const nextSet = setForLanguage(merged.set, partial.language, catalog.printings);
        if (nextSet) merged.set = nextSet;
      }
      return alignReleasedFilters(merged, partial);
    });
  }

  /** Depuis la fiche : remplace les critères de carte par le seul critère cliqué (extension, langue et tri conservés). */
  function filterOnly(partial: Partial<Filters>) {
    update({
      q: "",
      colors: [],
      types: [],
      tags: [],
      keywords: [],
      costs: [],
      powers: [],
      rams: [],
      artists: [],
      eddiable: "",
      rarity: "",
      ...partial,
      printingId: null,
      page: 1,
    });
  }

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

  function openPrinting(printingId: string) {
    if (!filters.printingId) pushUrlRef.current = true;
    update({ printingId });
  }

  function closePrinting() {
    if (openedWithPushRef.current) {
      // Revient à l'entrée d'avant l'ouverture : la carte se ferme via la synchro de l'URL.
      openedWithPushRef.current = false;
      window.history.back();
      return;
    }
    update({ printingId: null });
  }

  function openFilters() {
    if (isWideLayout()) setFiltersVisibility("open");
    else setFiltersDrawer(true);
  }

  function closeFilters() {
    if (filtersDrawer && !isWideLayout()) setFiltersDrawer(false);
    else setFiltersVisibility("closed");
  }

  function selectAllFiltered() {
    selectCards(filtered.map((printing) => printing.id));
  }

  function handleCardClick(event: React.MouseEvent, printingId: string) {
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

  function toggleFavorite(printingId: string) {
    const wishId = favoriteIds.get(printingId);
    const action = wishId ? wishlist.remove(wishId) : wishlist.save(printingId);
    action.catch((favoriteError: unknown) => {
      setAddError(favoriteError instanceof Error ? favoriteError.message : t("cards.favoriteFailed"));
    });
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

  function clearSelection() {
    setDraft({});
    setRangeAnchor(null);
    setAddError(null);
  }

  function closeQuickAdd() {
    setQuickAddId(null);
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

  const draftCards = Object.keys(draft).length;
  const draftCopies = Object.values(draft).reduce((sum, quantity) => sum + quantity, 0);
  const selectionPrice = useMemo(
    () => (draftCopies > 0 && catalog?.hasPrices ? selectionPriceTotal(catalog.printings, draft) : null),
    [catalog, draft, draftCopies],
  );

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
      <div
        ref={drawerRef}
        className={`${
          filtersDrawer
            ? "fixed inset-0 z-50 bg-black/70 lg:static lg:z-auto lg:bg-transparent"
            : "hidden"
        } ${filtersVisibility === "closed" ? "lg:hidden" : "lg:block"}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setFiltersDrawer(false);
        }}
      >
        <div
          className="pt-safe flex h-full w-[min(22rem,88vw)] flex-col border-r border-line bg-background lg:sticky lg:top-0 lg:block lg:h-auto lg:max-h-[100cqh] lg:w-auto lg:overflow-auto lg:border-0 lg:bg-transparent lg:pt-0 lg:pb-4 lg:pr-4 scrollbar-hud"
          role={filtersDrawer ? "dialog" : undefined}
          aria-modal={filtersDrawer ? true : undefined}
          aria-label={filtersDrawer ? t("cards.filters") : undefined}
        >
          <div className="scrollbar-hud min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:overflow-visible lg:p-0">
            <FilterPanel
              filters={activeFilters}
              facets={facets}
              sets={setChoices}
              conditions={catalog.conditions}
              onChange={update}
              onReset={() => update(defaultFilters(true, filterDefaults))}
              onClose={closeFilters}
            />
          </div>
          <div className="pb-safe shrink-0 border-t border-line bg-panel lg:hidden">
            <div className="p-3">
              <button
                type="button"
                className="h-11 w-full bg-yellow px-4 text-sm font-semibold text-black"
                onClick={() => setFiltersDrawer(false)}
              >
                {filtered.length === 0
                  ? t("cards.noCards")
                  : t("cards.cardCount", { count: fmt.int(filtered.length), noun: t("common.cards", { n: filtered.length }) })}
              </button>
            </div>
          </div>
        </div>
      </div>
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
            className="h-10 min-w-0 flex-1 basis-[calc(100%-3rem)] border border-line bg-panel px-3 text-sm outline-none focus:border-cyan sm:basis-40"
          />
          {(() => {
            const { field, dir } = splitSort(SORT_FIELDS, activeFilters.sort);
            const directional = field.keys.desc !== undefined;
            return (
              <div className="flex h-10 min-w-0 flex-1 sm:flex-none">
                <select
                  aria-label={t("cards.sort")}
                  className="h-10 min-w-0 flex-1 border border-line bg-panel px-3 text-sm"
                  value={field.id}
                  onChange={(event) => {
                    const next = SORT_FIELDS.find((item) => item.id === event.target.value) ?? SORT_FIELDS[0];
                    update({ sort: (dir === "desc" && next.keys.desc) || next.keys.asc, page: 1 });
                  }}
                >
                  {SORT_FIELDS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!directional}
                  aria-label={`${t("cards.sortToggleDirection")} (${dir === "asc" ? t("cards.sortAscending") : t("cards.sortDescending")})`}
                  title={dir === "asc" ? t("cards.sortAscending") : t("cards.sortDescending")}
                  className="grid h-10 w-10 shrink-0 place-items-center border border-l-0 border-line bg-panel text-cyan disabled:text-muted disabled:opacity-40"
                  onClick={() => {
                    if (!field.keys.desc) return;
                    update({ sort: dir === "asc" ? field.keys.desc : field.keys.asc, page: 1 });
                  }}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  >
                    <path d="M10 16V4M5 9l5-5 5 5" strokeLinecap="square" />
                  </svg>
                </button>
              </div>
            );
          })()}
          {!readOnly ? (
            <button
              type="button"
              aria-pressed={addMode}
              className={`h-10 shrink-0 px-3 text-sm ${addMode ? "bg-yellow font-semibold text-black" : "border border-yellow text-yellow"}`}
              onClick={() => {
                if (addMode) {
                  requestExitAddMode();
                  return;
                }
                setAddMode(true);
                setAddError(null);
                update({ printingId: null });
              }}
            >
              {t("cards.addMode")}
            </button>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              aria-pressed={keyboard.selecting}
              aria-keyshortcuts="S"
              className={`h-10 shrink-0 px-3 text-sm ${keyboard.selecting ? "bg-cyan font-semibold text-black" : "border border-cyan text-cyan"}`}
              onClick={() => (keyboard.selecting ? keyboard.stop() : keyboard.start())}
            >
              {t("cards.select")}
            </button>
          ) : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {keyboard.selecting ? t("cards.selectedCount", { n: draftCards }) : ""}
        </p>
        {effectiveAddMode ? (
          <div data-add-help="" className="mb-3 flex flex-col gap-3 border border-yellow/50 bg-panel p-3">
            <p className="text-sm text-muted pointer-coarse:hidden">{t("cards.addModeHelp")}</p>
            <p className="hidden text-sm text-muted pointer-coarse:block">{t("cards.addModeHelpTouch")}</p>
            {rangeAnchor ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-cyan">
                  {t("cards.rangeStart", { number: filtered.find((printing) => printing.id === rangeAnchor)?.collectorNumber ?? "" })}
                </p>
                <button type="button" className="h-9 border border-line px-3 text-sm" onClick={clearSelection}>
                  {t("cards.cancelSelection")}
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={t("cards.addCondition")}
                className="h-10 min-w-0 flex-1 border border-line bg-panel-2 px-3 font-mono text-sm sm:flex-none"
                value={addCondition}
                onChange={(event) => setAddCondition(event.target.value)}
              >
                {catalog.conditions.map((condition) => (
                  <option key={condition.code} value={condition.code} className="font-mono">
                    {conditionOptionLabel(condition, catalog.conditions)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="h-10 border border-line px-3 text-sm text-cyan disabled:opacity-40"
                onClick={selectAllFiltered}
                disabled={filtered.length === 0}
              >
                {t("cards.selectAll")}
              </button>
            </div>
          </div>
        ) : null}
        <div data-card-zone="" className={effectiveAddMode ? "select-none" : undefined}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
          <p>
            {filtered.length === 0
              ? t("cards.noCards")
              : t("cards.cardCount", { count: fmt.int(filtered.length), noun: t("common.cards", { n: filtered.length }) })}
          </p>
          {listPrice && filtered.length > 0 ? (
            <p className="font-mono text-yellow">
              {listPrice.unpriced > 0
                ? t(missingList ? "cards.missingTotalPartial" : "cards.listTotalPartial", { total: fmt.money(listPrice.total), unpriced: fmt.int(listPrice.unpriced) })
                : t(missingList ? "cards.missingTotal" : "cards.listTotal", { total: fmt.money(listPrice.total) })}
            </p>
          ) : null}
          {selectionPrice ? (
            <p className="font-mono text-cyan" aria-live="polite">
              {selectionPrice.unpriced > 0
                ? t("cards.selectionTotalPartial", { total: fmt.money(selectionPrice.total), unpriced: fmt.int(selectionPrice.unpriced) })
                : t("cards.selectionTotal", { total: fmt.money(selectionPrice.total) })}
            </p>
          ) : null}
        </div>
        {filtered.length === 0 ? (
          <p className="border border-line px-4 py-10 text-center text-sm text-muted">{t("cards.noMatch")}</p>
        ) : (
          <VirtualCardGrid
            items={filtered}
            cardsById={cardsById}
            ownership={(printingId) => ownershipOf(printingId, agg).qty}
            draft={draft}
            rangeAnchor={rangeAnchor}
            addMode={effectiveAddMode}
            filtersCollapsed={filtersVisibility === "closed"}
            layoutRef={gridLayoutRef}
            onCardClick={handleCardClick}
            onCardContextMenu={(event, printingId) => {
              if (!effectiveAddMode) return;
              event.preventDefault();
              removeFromSelection(printingId);
            }}
            onQueue={queueCard}
            onUnqueue={unqueueCard}
            isFavorite={(printingId) => favoriteIds.has(printingId)}
            favoritesReady={wishlist.ready}
            onToggleFavorite={readOnly ? undefined : toggleFavorite}
            focusIndex={keyboard.focusIndex}
            focusRequest={keyboard.focusRequest}
            selecting={keyboard.selecting}
            onTileFocus={keyboard.onTileFocus}
            onGridKeyDown={keyboard.onKeyDown}
            onGridKeyUp={keyboard.onKeyUp}
          />
        )}
        </div>
      </div>
      {selected && selectedCard ? (
        <CardModal
          printing={selected}
          card={selectedCard}
          siblings={catalog.printings
            .filter((printing) => printing.cardId === selected.cardId && printing.id !== selected.id)
            .sort(
              (a, b) =>
                a.setName.localeCompare(b.setName, "fr") ||
                a.collectorNumber.localeCompare(b.collectorNumber, "fr", { numeric: true }),
            )}
          items={items.filter((item) => item.printingId === selected.id)}
          conditions={catalog.conditions}
          ownedIds={ownedIds}
          onOpen={(id) => update({ printingId: id })}
          onClose={closePrinting}
          prevId={prevId}
          nextId={nextId}
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
        <div
          ref={leaveRef}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-add-mode-title"
        >
          <div className="w-full max-w-md border border-yellow bg-panel p-5">
            <h2 id="leave-add-mode-title" className="text-lg text-yellow">
              {t("cards.leaveTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("cards.leaveBody", { count: fmt.int(draftCards), noun: t("common.cards", { n: draftCards }) })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={stayRef} type="button" className="h-10 border border-line px-4 text-sm" onClick={() => setLeaveConfirm(false)}>
                {t("cards.stay")}
              </button>
              <button type="button" className="h-10 bg-yellow px-4 text-sm font-semibold text-black" onClick={exitAddMode}>
                {t("cards.leave")}
              </button>
            </div>
          </div>
        </div>
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
