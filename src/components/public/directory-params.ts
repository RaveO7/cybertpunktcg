// Paramètres d'URL de l'annuaire, partagés par la page serveur (premier rendu) et le client.

import { isPeriod, periodRange } from "@/lib/tournament/periods";

export type DirectoryParams = Record<string, string>;

/** Clés de l'URL de la page (from/to : dates AAAA-MM-JJ de la période « dates libres »). */
export const PAGE_KEYS = [
  "country",
  "region",
  "city",
  "lat",
  "lng",
  "radius",
  "place",
  "period",
  "from",
  "to",
  "format",
  "match",
  "price",
  "seats",
  "open",
  "shop",
  "sort",
  "page",
  "view",
] as const;

export function cleanParams(params: Record<string, string | string[] | undefined>): DirectoryParams {
  const out: DirectoryParams = {};
  for (const key of PAGE_KEYS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) out[key] = value.slice(0, 120);
  }
  return out;
}

/** Paramètres de la page → paramètres de l'API (période convertie en bornes ISO). */
export function apiParams(params: DirectoryParams, now: Date) {
  const { period, from, to, ...rest } = cleanParams(params);
  // Libellé du point de recherche : affichage seulement.
  delete rest.place;
  const api = new URLSearchParams(rest);
  const range = isPeriod(period) ? periodRange(period, now, { from, to }) : {};
  if (range.from) api.set("from", range.from.toISOString());
  if (range.to) api.set("to", range.to.toISOString());
  return api;
}
