"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { BETA_SET_CODE } from "@/lib/reference-data";

type Selection = { set: string; language: string };

function hrefFor(selection: Selection) {
  const params = new URLSearchParams();
  if (selection.set) params.set("set", selection.set);
  if (selection.language) params.set("language", selection.language);
  const query = params.toString();
  return query ? `/cards?${query}` : "/cards";
}

const BrowseSelectionContext = createContext<{
  selection: Selection;
  cardsHref: string;
  setSelection: (value: Selection) => void;
  setCardsLocation: (value: Selection, href: string) => void;
} | null>(null);

export function BrowseSelectionProvider({ children }: { children: React.ReactNode }) {
  const initial = { set: BETA_SET_CODE, language: "en" };
  const [selection, setSelectionState] = useState<Selection>(initial);
  const [cardsHref, setCardsHref] = useState(hrefFor(initial));
  const setSelection = useCallback((next: Selection) => {
    setSelectionState((current) =>
      current.set === next.set && current.language === next.language ? current : next,
    );
    const href = hrefFor(next);
    setCardsHref((current) => (current === href ? current : href));
  }, []);
  const setCardsLocation = useCallback((next: Selection, href: string) => {
    setSelectionState((current) =>
      current.set === next.set && current.language === next.language ? current : next,
    );
    setCardsHref((current) => (current === href ? current : href));
  }, []);
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
