/**
 * Chemins localisés des pages publiques (métadonnées, sitemap, données structurées, liens des pages
 * serveur) et équivalent d'une URL dans une autre langue (sélecteur, suggestion de langue). Les URL
 * viennent de la configuration de routage next-intl (src/i18n/routing.ts).
 */

import { INTERNATIONAL_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import { matchRoute, type RouteParams } from "@/i18n/match";
import { getPathname } from "@/i18n/navigation";
import { landingSections, type AppPathname } from "@/i18n/routing";

/** Pages publiques indexées, disponibles dans chaque langue. */
export const PUBLIC_ROUTES = {
  home: "/",
  cards: "/cartes",
  card: "/cartes/[slug]",
  tournament: "/tournois/publics/[id]",
  shop: "/boutiques/[slug]",
  legalNotice: "/mentions-legales",
  terms: "/cgu",
  privacy: "/confidentialite",
} as const satisfies Record<string, AppPathname>;

export type PublicRouteKey = keyof typeof PUBLIC_ROUTES;

function withSearch(path: string, search?: string | URLSearchParams | null): string {
  const query = typeof search === "string" ? search.replace(/^\?/, "") : (search?.toString() ?? "");
  return query ? `${path}?${query}` : path;
}

/** URL d'une route dans une langue. */
export function routePath(route: AppPathname, locale: Locale, params: RouteParams = {}): string {
  const href = Object.keys(params).length > 0 ? { pathname: route, params } : route;
  return getPathname({ href: href as never, locale });
}

/** Chemin d'une page publique dans une langue, avec sa query éventuelle. */
export function localizedPath(
  key: PublicRouteKey,
  locale: Locale,
  params: RouteParams = {},
  search?: string | URLSearchParams | null,
): string {
  return withSearch(routePath(PUBLIC_ROUTES[key], locale, params), search);
}

/** Même page dans une autre langue (query conservée), ou null si l'URL ne correspond à aucune page. */
export function alternatePath(pathname: string, search: string | URLSearchParams | null | undefined, target: Locale): string | null {
  const match = matchRoute(pathname);
  return match ? withSearch(routePath(match.route, target, match.params), search) : null;
}

/** Versions linguistiques d'une page (pour hreflang et le sitemap) ; x-default = anglais (international). */
export function languageAlternates(key: PublicRouteKey, params: RouteParams = {}): Record<Locale | "x-default", string> {
  const paths = Object.fromEntries(LOCALES.map((locale) => [locale, localizedPath(key, locale, params)])) as Record<Locale, string>;
  return { ...paths, "x-default": paths[INTERNATIONAL_LOCALE] };
}

export type LocalizedRoute = { key: PublicRouteKey; locale: Locale; params: RouteParams };

/** Page publique indexée correspondant à une URL (« /it/carte/v »), ou null (application…). */
export function publicRouteOfPath(pathname: string): LocalizedRoute | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = matchRoute(clean);
  if (!match) return null;
  const key = (Object.keys(PUBLIC_ROUTES) as PublicRouteKey[]).find((entry) => PUBLIC_ROUTES[entry] === match.route);
  return key ? { key, locale: match.locale, params: match.params } : null;
}

/** Lien vers une section de l'accueil des visiteurs (« /#tournois », « /en#shops »). */
export function landingSectionPath(section: "tournaments" | "shops", locale: Locale): string {
  return `${localizedPath("home", locale)}#${landingSections[locale][section]}`;
}
