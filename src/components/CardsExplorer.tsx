"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { CardModal } from "@/components/CardModal";
import { useCollection } from "@/components/CollectionProvider";
import { FilterPanel } from "@/components/FilterPanel";
import { cardIdsInBox, VirtualCardGrid, type CardGridLayout } from "@/components/VirtualCardGrid";
import {
  aggregateCollection,
  alignReleasedFilters,
  browseChecklist,
  languageOptions,
  setForLanguage,
  buildFacets,
  defaultFilters,
  filterPrintings,
  formatInt,
  formatMoney,
  ownershipOf,
  printingsPriceTotal,
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
} from "@/lib/reference-data";
import type { CatalogDTO, CollectionItemDTO, Filters, PrintingDTO } from "@/lib/types";
import { useI18n } from "@/components/LocaleProvider";
import { usePreferences } from "@/components/PreferencesProvider";
import { conditionOptionLabel } from "@/lib/condition-label";
import type { Messages } from "@/lib/i18n/messages";
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

function sortOptions(t: Messages): { value: Filters["sort"]; label: string }[] {
  return [
    { value: "default", label: t.cards.sortDefault },
    { value: "number-asc", label: t.cards.sortNumberAsc },
    { value: "number-desc", label: t.cards.sortNumberDesc },
    { value: "cost-asc", label: t.cards.sortCostAsc },
    { value: "cost-desc", label: t.cards.sortCostDesc },
    { value: "name-asc", label: t.cards.sortNameAsc },
    { value: "name-desc", label: t.cards.sortNameDesc },
    { value: "rarity", label: t.cards.sortRarity },
    { value: "set", label: t.cards.groupSet },
    { value: "owned-first", label: t.cards.groupOwnedFirst },
    { value: "missing-first", label: t.cards.groupMissingFirst },
  ];
}

export function CardsExplorer({
  readOnly = false,
  catalog: catalogProp,
  items: itemsProp,
  urlBase = "/cards",
  syncBrowseSelection = true,
}: {
  readOnly?: boolean;
  catalog?: CatalogDTO | null;
  items?: CollectionItemDTO[];
  urlBase?: string;
  syncBrowseSelection?: boolean;
} = {}) {
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
  } = useCollection();
  const catalog = catalogProp ?? collectionCatalog;
  const items = itemsProp ?? collectionItems;
  const ready = catalogProp != null ? true : collectionReady;
  const error = catalogProp != null ? null : collectionError;
  const { setCardsLocation } = useBrowseSelection();
  const { t } = useI18n();
  const { prefs } = usePreferences();
  const filterDefaults = useMemo(() => filterDefaultsFrom(prefs), [prefs.collection, prefs.sort]);
  const SORTS = sortOptions(t);
  const [filters, setFilters] = useState<Filters>(() => parseFilters(searchParams, true, filterDefaultsFrom(prefs)));
  const [filtersVisibility, setFiltersVisibility] = useState<"auto" | "open" | "closed">(prefs.filtersPanel);
  // Tiroir de filtres sur téléphone/tablette, indépendant de la colonne de bureau.
  const [filtersDrawer, setFiltersDrawer] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const effectiveAddMode = readOnly ? false : addMode;
  const [addCondition, setAddCondition] = useState(prefs.condition);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const ctrlHandled = useRef(false);
  const ctrlDown = useRef(false);
  const draftRef = useRef(draft);
  const gridLayoutRef = useRef<CardGridLayout | null>(null);
  const filteredRef = useRef<PrintingDTO[]>([]);
  const urlSyncRef = useRef(searchParams.toString());
  // Ouvrir une carte ajoute une entrée d'historique : le bouton retour (Android, geste iOS) la ferme.
  const pushUrlRef = useRef(false);
  const openedWithPushRef = useRef(false);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    setAddCondition(prefs.condition);
  }, [prefs.condition]);
  useEffect(() => {
    const key = searchParams.toString();
    if (key === urlSyncRef.current) return;
    urlSyncRef.current = key;
    setFilters(parseFilters(new URLSearchParams(key), true, filterDefaults));
  }, [searchParams, filterDefaults]);
  const [addError, setAddError] = useState<string | null>(null);

  const cardsById = useMemo(() => new Map(catalog?.cards.map((card) => [card.id, card]) ?? []), [catalog]);
  const setsByCode = useMemo(() => new Map(catalog?.sets.map((set) => [set.code, set]) ?? []), [catalog]);
  const activeFilters = useMemo(() => alignReleasedFilters(filters), [filters]);
  // Each printing keeps its own ownership: a beta copy must not mark the retail card as owned.
  const agg = useMemo(() => aggregateCollection(items), [items]);

  useEffect(() => {
    const params = serializeFilters(activeFilters, true, filterDefaults);
    const query = params.toString();
    const nextUrl = query ? `${urlBase}?${query}` : urlBase;
    urlSyncRef.current = query;
    if (syncBrowseSelection) {
      setCardsLocation({ set: activeFilters.set, language: activeFilters.language }, nextUrl);
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
  }, [activeFilters, filterDefaults, setCardsLocation, syncBrowseSelection, urlBase]);

  useEffect(() => {
    if (!filtersDrawer) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersDrawer(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersDrawer]);
  const setPrintings = useMemo(() => {
    if (!catalog) return [];
    if (activeFilters.set === ALL_SETS_ID) {
      return catalog.printings.filter((printing) => !isSealedSetCode(printing.setCode));
    }
    const checklist = browseChecklist(catalog.printings, activeFilters.set);
    if (checklist) return checklist;
    return catalog.printings.filter((printing) => printing.setCode === activeFilters.set);
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

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const matched = filterPrintings(
      catalog.printings,
      cardsById,
      agg,
      activeFilters,
      browseChecklist(catalog.printings, activeFilters.set),
    );
    return sortPrintings(matched, cardsById, agg, setsByCode, activeFilters.sort);
  }, [catalog, cardsById, agg, activeFilters, setsByCode]);

  const missingPrice = useMemo(
    () => (activeFilters.collection === "missing" && catalog?.hasPrices ? printingsPriceTotal(filtered) : null),
    [activeFilters.collection, catalog?.hasPrices, filtered],
  );

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
      deselect: false,
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

    // Viewport coordinates — AppFrame scrolls <main>, not the window.
    const pageBox = () => {
      const x = drag.pointerX;
      const y = drag.pointerY;
      const left = Math.min(drag.startX, x);
      const top = Math.min(drag.startY, y);
      const right = Math.max(drag.startX, x);
      const bottom = Math.max(drag.startY, y);
      return { left, top, right, bottom };
    };

    const cardsInside = (box: { left: number; top: number; right: number; bottom: number }) => {
      const layout = gridLayoutRef.current;
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
      setDraft(() => {
        const next = { ...drag.base };
        for (const id of inside) {
          if (drag.deselect) delete next[id];
          else if (!next[id]) next[id] = 1;
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
      if (!target.closest("[data-card-grid]") && !target.closest("[data-card-id]")) return;
      event.preventDefault();
      event.stopPropagation();
      active = true;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.pointerX = event.clientX;
      drag.pointerY = event.clientY;
      drag.moved = false;
      drag.base = { ...draftRef.current };
      const origin = target.closest("[data-card-id]");
      const originId = origin?.getAttribute("data-card-id");
      drag.deselect = Boolean(originId && drag.base[originId]);
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
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("click", onClick, true);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [effectiveAddMode]);

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
    if (ctrlHandled.current || event.ctrlKey || event.metaKey || event.getModifierState("Control") || ctrlDown.current) {
      event.preventDefault();
      if (!ctrlHandled.current) toggleCard(printingId);
      ctrlHandled.current = false;
      ctrlDown.current = event.ctrlKey || event.metaKey || event.getModifierState("Control");
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
    queueCard(printingId);
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

  function exitAddMode() {
    setAddMode(false);
    setLeaveConfirm(false);
    setAddError(null);
    setRangeAnchor(null);
    setDraft({});
    setMarquee(null);
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

  async function commitDraft() {
    const lines = Object.entries(draft).map(([printingId, quantity]) => ({ printingId, quantity }));
    if (lines.length === 0) return;
    setAdding(true);
    setAddError(null);
    try {
      await saveBatch({ conditionCode: addCondition, lines });
      exitAddMode();
    } catch (commitError) {
      setAddError(commitError instanceof Error ? commitError.message : t.cards.addFailed);
    } finally {
      setAdding(false);
    }
  }

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!ready || !catalog || !facets) return <p className="p-6 text-muted">{t.common.loading}</p>;
  if (catalog.printings.length === 0) {
    return (
      <p className="p-6 text-sm text-muted">
        {t.investment.emptyCatalog} <code className="text-cyan">npm run import:cards</code>.
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
          aria-label={filtersDrawer ? t.cards.filters : undefined}
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
                  ? t.cards.noCards
                  : t.cards.cardCount(formatInt(filtered.length), t.common.cards(filtered.length))}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-4 flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3">
          <button
            type="button"
            aria-label={t.cards.filters}
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
            placeholder={t.cards.searchPlaceholder}
            aria-label={t.common.search}
            type="search"
            enterKeyHint="search"
            className="h-10 min-w-0 flex-1 basis-[calc(100%-3rem)] border border-line bg-panel px-3 text-sm outline-none focus:border-cyan sm:basis-40"
          />
          <select
            aria-label={t.cards.sort}
            className="h-10 min-w-0 flex-1 border border-line bg-panel px-3 text-sm sm:flex-none"
            value={activeFilters.sort}
            onChange={(event) => update({ sort: event.target.value as Filters["sort"], page: 1 })}
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
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
              {t.cards.addMode}
            </button>
          ) : null}
        </div>
        {effectiveAddMode ? (
          <div className="mb-3 flex flex-col gap-3 border border-yellow/50 bg-panel p-3">
            <p className="text-sm text-muted pointer-coarse:hidden">{t.cards.addModeHelp}</p>
            <p className="hidden text-sm text-muted pointer-coarse:block">{t.cards.addModeHelpTouch}</p>
            {rangeAnchor ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-cyan">
                  {t.cards.rangeStart(filtered.find((printing) => printing.id === rangeAnchor)?.collectorNumber ?? "")}
                </p>
                <button type="button" className="h-9 border border-line px-3 text-sm" onClick={clearSelection}>
                  {t.cards.cancelSelection}
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={t.cards.addCondition}
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
                {t.cards.selectAll}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
          <p>
            {filtered.length === 0
              ? t.cards.noCards
              : t.cards.cardCount(formatInt(filtered.length), t.common.cards(filtered.length))}
          </p>
          {missingPrice && filtered.length > 0 ? (
            <p className="font-mono text-yellow">
              {missingPrice.unpriced > 0
                ? t.cards.missingTotalPartial(formatMoney(missingPrice.total), formatInt(missingPrice.unpriced))
                : t.cards.missingTotal(formatMoney(missingPrice.total))}
            </p>
          ) : null}
        </div>
        {filtered.length === 0 ? (
          <p className="border border-line px-4 py-10 text-center text-sm text-muted">{t.cards.noMatch}</p>
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
          />
        )}
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
        />
      ) : null}
      {leaveConfirm && !readOnly ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-add-mode-title"
        >
          <div className="w-full max-w-md border border-yellow bg-panel p-5">
            <h2 id="leave-add-mode-title" className="text-lg text-yellow">
              {t.cards.leaveTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t.cards.leaveBody(formatInt(draftCards), t.common.cards(draftCards))}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="h-10 border border-line px-4 text-sm" onClick={() => setLeaveConfirm(false)}>
                {t.cards.stay}
              </button>
              <button type="button" className="h-10 bg-yellow px-4 text-sm font-semibold text-black" onClick={exitAddMode}>
                {t.cards.leave}
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
        <div className="fixed inset-x-0 bottom-[var(--app-bottom-nav)] z-30 border-t border-yellow/60 bg-background/95 px-4 pt-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-var(--app-bottom-nav)))] backdrop-blur">
          <div
            className={`mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
              filtersVisibility === "closed" ? "max-w-[80rem]" : "max-w-[1600px]"
            }`}
          >
            <div>
              <p className="font-medium">
                {draftCopies === 0
                  ? t.cards.noneSelected
                  : t.cards.selectionSummary(
                      formatInt(draftCopies),
                      t.common.copies(draftCopies),
                      formatInt(draftCards),
                      t.common.cards(draftCards),
                    )}
              </p>
              {addError ? <p className="text-sm text-danger">{addError}</p> : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-11 shrink-0 whitespace-nowrap border border-line px-3 text-sm disabled:opacity-40 sm:px-4"
                onClick={clearSelection}
                disabled={(draftCards === 0 && !rangeAnchor) || adding}
              >
                {t.cards.cancelSelection}
              </button>
              <button
                type="button"
                className="h-11 min-w-0 flex-1 truncate bg-yellow px-3 text-sm font-semibold text-black disabled:opacity-50 sm:flex-none sm:px-4 sm:text-base"
                disabled={draftCards === 0 || adding}
                onClick={() => void commitDraft()}
              >
                {adding ? t.cards.adding : t.cards.addSelection}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
