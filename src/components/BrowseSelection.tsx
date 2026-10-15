"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Href } from "@/i18n/navigation";
import { BETA_SET_CODE } from "@/lib/reference-data";

type Selection = { set: string; language: string };

function queryFor(selection: Selection) {
  const params = new URLSearchParams();
  if (selection.set) params.set("set", selection.set);
  if (selection.language) params.set("language", selection.language);
  return params.toString();
}

/** Lien vers l'explorateur de cartes avec une query (« set=…&language=… »). */
function hrefFor(query: string): Href {
  return query ? { pathname: "/cards", query: Object.fromEntries(new URLSearchParams(query)) } : "/cards";
}

const BrowseSelectionContext = createContext<{
  selection: Selection;
  cardsHref: Href;
  setSelection: (value: Selection) => void;
  /** Dernière recherche de l'explorateur (query de son URL), reprise par l'onglet Cartes. */
  setCardsLocation: (value: Selection, query: string) => void;
} | null>(null);

export function BrowseSelectionProvider({ children }: { children: React.ReactNode }) {
  const initial = { set: BETA_SET_CODE, language: "en" };
  const [selection, setSelectionState] = useState<Selection>(initial);
  const [cardsQuery, setCardsQuery] = useState(queryFor(initial));
  const setSelection = useCallback((next: Selection) => {
    setSelectionState((current) =>
      current.set === next.set && current.language === next.language ? current : next,
    );
    setCardsQuery(queryFor(next));
  }, []);
  const setCardsLocation = useCallback((next: Selection, query: string) => {
    setSelectionState((current) =>
      current.set === next.set && current.language === next.language ? current : next,
    );
    setCardsQuery(query);
  }, []);
  const cardsHref = useMemo(() => hrefFor(cardsQuery), [cardsQuery]);
  const value = useMemo(
    () => ({ selection, cardsHref, setSelection, setCardsLocation }),
    [cardsHref, selection, setCardsLocation, setSelection],
  );
  return <BrowseSelectionContext.Provider value={value}>{children}</BrowseSelectionContext.Provider>;
}

export function useBrowseSelection() {
  const value = useContext(BrowseSelectionContext);
  if (!value) throw new Error("useBrowseSelection doit être utilisé dans le provider.");
  return value;
}
