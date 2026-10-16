"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { internalPath, matchInternalPath, matchRoute, splitLocale } from "@/i18n/match";

/** Chemin interne (segments français, sans préfixe de langue) d'une URL du site. */
export function toInternalPathname(pathname: string): string {
  const match = matchRoute(pathname) ?? matchInternalPath(pathname);
  return match ? internalPath(match.route, match.params) : splitLocale(pathname).rest;
}

/**
 * Chemin interne de la page affichée, avec ses valeurs : « /de/karten/x » → « /cartes/x »,
 * « /it/decks » → « /decks ». Sert à repérer la page active (navigation, pied de page…).
 *
 * Lu dans les segments de route rendus sous la mise en page [locale] (la seule de l'application), et non
 * dans l'URL : le serveur voit l'URL réécrite par le proxy, le navigateur l'URL publique, et elles se
 * confondent parfois (« /en/cards » : catalogue public, mais aussi URL interne de « /en/explorer »).
 * Les segments, eux, sont les mêmes des deux côtés : pas d'écart d'hydratation.
 */
export function useInternalPathname(): string {
  const segments = useSelectedLayoutSegments().filter((segment) => !segment.startsWith("(") && !segment.startsWith("__"));
  return segments.length ? `/${segments.map(decodeSegment).join("/")}` : "/";
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
