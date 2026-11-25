"use client";

import { useDeferredValue, useMemo } from "react";
import { orderedSetChoices } from "@/components/cards-explorer/list-helpers";
import { aggregateCollection } from "@/lib/cards/collection-stats";
import { buildFacets, filterPrintings } from "@/lib/cards/filters";
import { browseChecklist, languageOptions } from "@/lib/cards/printings";
import { sortPrintings } from "@/lib/cards/sort";
import { ALL_SETS_ID, isSealedSetCode, parseSetList } from "@/lib/reference-data";
import type { CatalogDTO, CollectionItemDTO, Filters } from "@/lib/types";

/** Données dérivées du catalogue et de la collection : possession, facettes, extensions et liste filtrée triée. */
export function useExplorerData(
  catalog: CatalogDTO | null,
  items: CollectionItemDTO[],
  activeFilters: Filters,
  listFilters: Filters,
  defaultSort: Filters["sort"],
) {
  const cardsById = useMemo(() => new Map(catalog?.cards.map((card) => [card.id, card]) ?? []), [catalog]);
  const setsByCode = useMemo(() => new Map(catalog?.sets.map((set) => [set.code, set]) ?? []), [catalog]);
  // Each printing keeps its own ownership: a beta copy must not mark the retail card as owned.
  const agg = useMemo(() => aggregateCollection(items), [items]);

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
  const setChoices = useMemo(() => (catalog ? orderedSetChoices(catalog.sets) : []), [catalog]);

  // La saisie s'affiche tout de suite ; le filtrage du catalogue suit sans bloquer la frappe.
  const deferredQuery = useDeferredValue(listFilters.q);
  const filtered = useMemo(() => {
    if (!catalog) return [];
    const searchFilters = deferredQuery === listFilters.q ? listFilters : { ...listFilters, q: deferredQuery };
    const matched = filterPrintings(
      catalog.printings,
      cardsById,
      agg,
      searchFilters,
      browseChecklist(catalog.printings, searchFilters.set),
    );
    return sortPrintings(matched, cardsById, agg, setsByCode, searchFilters.sort, {
      q: searchFilters.q,
      defaultSort,
    });
  }, [catalog, cardsById, agg, listFilters, deferredQuery, setsByCode, defaultSort]);

  // The modal lists each printing separately, beta and retail included.
  const ownedIds = useMemo(
    () => new Set(items.filter((item) => item.quantity > 0).map((item) => item.printingId)),
    [items],
  );

  return { cardsById, agg, facets, setChoices, filtered, ownedIds };
}
