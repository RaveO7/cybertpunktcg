"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { sameListFilters } from "@/components/cards-explorer/list-helpers";
import { usePreferences } from "@/components/PreferencesProvider";
import { alignReleasedFilters, parseFilters, sealedBrowseFilters, serializeFilters } from "@/lib/cards/filters";
import { setForLanguage } from "@/lib/cards/printings";
import { filterDefaultsFrom } from "@/lib/preferences";
import { isSealedSetCode } from "@/lib/reference-data";
import type { CatalogDTO, Filters } from "@/lib/types";

/**
 * Critères de la liste de cartes et leur synchronisation avec l'URL (lecture de la query, écriture,
 * historique du bouton retour pour la fiche ouverte, contexte de l'onglet Cartes).
 */
export function useExplorerFilters(catalog: CatalogDTO | null | undefined, syncBrowseSelection: boolean) {
  const searchParams = useSearchParams();
  const { setCardsLocation } = useBrowseSelection();
  const { prefs } = usePreferences();
  const { sort: prefSort, collection: prefCollection } = prefs;
  const filterDefaults = useMemo(
    () => filterDefaultsFrom({ sort: prefSort, collection: prefCollection }),
    [prefSort, prefCollection],
  );
  const [filters, setFilters] = useState<Filters>(() => parseFilters(searchParams, true, filterDefaultsFrom(prefs)));
  const urlSyncRef = useRef(searchParams.toString());
  // Dernière recherche envoyée à l'onglet Cartes.
  const cardsLocationRef = useRef<string | null>(null);
  // Ouvrir une carte ajoute une entrée d'historique : le bouton retour (Android, geste iOS) la ferme.
  const pushUrlRef = useRef(false);
  const openedWithPushRef = useRef(false);

  useEffect(() => {
    const key = searchParams.toString();
    if (key === urlSyncRef.current) return;
    urlSyncRef.current = key;
    setFilters(parseFilters(new URLSearchParams(key), true, filterDefaults));
  }, [searchParams, filterDefaults]);

  const activeFilters = useMemo(() => alignReleasedFilters(filters), [filters]);
  // Critères de la liste, inchangés quand on passe d'une fiche à l'autre : la grille et le filtrage
  // du catalogue ne sont pas recalculés à chaque carte (navigation au clavier touche maintenue).
  const [listFilters, setListFilters] = useState(activeFilters);
  if (listFilters !== activeFilters && !sameListFilters(listFilters, activeFilters)) {
    setListFilters(activeFilters);
  }

  useEffect(() => {
    const params = serializeFilters(activeFilters, true, filterDefaults);
    const query = params.toString();
    // Page affichée, dans sa langue (« /de/explorer », « /classeur/…/cartes ») : seule la query change.
    const base = window.location.pathname;
    const nextUrl = query ? `${base}?${query}` : base;
    urlSyncRef.current = query;
    if (syncBrowseSelection) {
      // L'onglet Cartes reprend la recherche, pas la fiche ouverte : parcourir les fiches (flèches)
      // ne met pas à jour le contexte à chaque carte (setState en cascade depuis cet effet).
      const location = new URLSearchParams(params);
      location.delete("printing");
      const locationQuery = location.toString();
      const key = `${activeFilters.set}|${activeFilters.language}|${locationQuery}`;
      if (cardsLocationRef.current !== key) {
        cardsLocationRef.current = key;
        setCardsLocation({ set: activeFilters.set, language: activeFilters.language }, locationQuery);
      }
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

  return { filters, activeFilters, listFilters, filterDefaults, update, filterOnly, openPrinting, closePrinting };
}
