"use client";

import { useSyncExternalStore } from "react";

/** Point de rupture `md` de Tailwind : tableau sur ordinateur, liste sur téléphone. */
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Largeur ordinateur : une seule des deux mises en page est rendue (l'autre serait masquée en CSS). */
export function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}
