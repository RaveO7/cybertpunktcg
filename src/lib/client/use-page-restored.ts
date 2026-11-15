"use client";

import { useEffect, useState } from "react";

/**
 * Nombre de retours sur la page par le cache arrière/avant du navigateur (bouton « retour ») : la page
 * revient telle qu'elle était, sans nouveau rendu. À mettre dans les dépendances d'un effet de
 * chargement pour redemander les données à chaque retour.
 */
export function usePageRestored() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setCount((value) => value + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return count;
}
