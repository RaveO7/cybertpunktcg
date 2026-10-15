"use client";

import { usePathname } from "next/navigation";
import { internalPath, matchInternalPath, matchRoute, splitLocale } from "@/i18n/match";

/** Chemin interne (segments français, sans préfixe de langue) d'une URL du site. */
export function toInternalPathname(pathname: string): string {
  const match = matchRoute(pathname) ?? matchInternalPath(pathname);
  return match ? internalPath(match.route, match.params) : splitLocale(pathname).rest;
}

/**
 * Chemin interne de la page affichée, avec ses valeurs : « /de/karten/x » → « /cartes/x »,
 * « /it/decks » → « /decks ». Identique au serveur et au client, que l'URL reçue soit l'URL publique
 * ou l'URL réécrite par le proxy. Sert à repérer la page active (navigation, pied de page…).
 */
export function useInternalPathname(): string {
  return toInternalPathname(usePathname());
}
