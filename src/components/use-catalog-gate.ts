"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DECKS_LIST_PATH } from "@/lib/boot-requests";

function createGate() {
  let open = () => undefined as void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/**
 * Moment où CollectionProvider peut demander le catalogue : tout de suite, sauf sur la liste des decks
 * (DECKS_LIST_PATH), où il attend qu'un écran le réclame (`requireCatalog` : decks à résumer, éditeur) ou
 * que l'on quitte la page. Ouvert une fois, il le reste.
 */
export function useCatalogGate() {
  const pathname = usePathname();
  const [required, setRequired] = useState(false);
  const [gate] = useState(createGate);
  const wanted = required || !DECKS_LIST_PATH.test(pathname);
  useEffect(() => {
    if (wanted) gate.open();
  }, [wanted, gate]);
  const requireCatalog = useCallback(() => setRequired(true), []);
  return { catalogWanted: gate.promise, requireCatalog };
}
