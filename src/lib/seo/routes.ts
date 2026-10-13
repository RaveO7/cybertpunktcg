/**
 * Pages publiques bilingues : français sans préfixe, anglais sous /en.
 * Seule source de la correspondance FR ↔ EN (métadonnées, sitemap, liens, sélecteur de langue).
 */

export type SiteLocale = "fr" | "en";

export const SITE_LOCALES: readonly SiteLocale[] = ["fr", "en"];

export type PublicRouteKey = "home" | "cards" | "card" | "howToPlay" | "tournaments" | "tournament" | "shops" | "shop";

type RouteParams = Record<string, string>;

const PUBLIC_ROUTES: { key: PublicRouteKey; fr: string; en: string }[] = [
  { key: "home", fr: "/", en: "/en" },
  { key: "cards", fr: "/cartes", en: "/en/cards" },
  { key: "card", fr: "/cartes/[slug]", en: "/en/cards/[slug]" },
  { key: "howToPlay", fr: "/comment-jouer", en: "/en/how-to-play" },
  { key: "tournaments", fr: "/tournois/publics", en: "/en/tournaments" },
  { key: "tournament", fr: "/tournois/publics/[id]", en: "/en/tournaments/[id]" },
  { key: "shops", fr: "/boutiques", en: "/en/shops" },
  { key: "shop", fr: "/boutiques/[slug]", en: "/en/shops/[slug]" },
];

/** Pages publiques qui n'existent qu'en français (pages légales). */
export const FRENCH_ONLY_PATHS: readonly string[] = ["/mentions-legales", "/cgu", "/confidentialite"];

function fill(pattern: string, params: RouteParams): string {
  return pattern.replace(/\[(\w+)\]/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Paramètre manquant : ${name}`);
    return encodeURIComponent(value);
  });
}

function withSearch(path: string, search?: string | URLSearchParams | null): string {
  const query = typeof search === "string" ? search.replace(/^\?/, "") : search?.toString() ?? "";
  return query ? `${path}?${query}` : path;
}

/** Chemin d'une page publique dans une langue, avec sa query éventuelle. */
export function localizedPath(
  key: PublicRouteKey,
  locale: SiteLocale,
  params: RouteParams = {},
  search?: string | URLSearchParams | null,
): string {
  const route = PUBLIC_ROUTES.find((entry) => entry.key === key)!;
  return withSearch(fill(route[locale], params), search);
}

function matchPattern(pattern: string, pathname: string): RouteParams | null {
  const expected = pattern.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: RouteParams = {};
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index];
    const dynamic = /^\[(\w+)\]$/.exec(segment);
    if (dynamic) {
      try {
        params[dynamic[1]] = decodeURIComponent(actual[index]);
      } catch {
        return null;
      }
    } else if (segment !== actual[index]) {
      return null;
    }
  }
  return params;
}

export type LocalizedRoute = { key: PublicRouteKey; locale: SiteLocale; params: RouteParams };

/** Page publique bilingue correspondant à un chemin, ou null (application, pages légales…). */
export function routeOfPath(pathname: string): LocalizedRoute | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const route of PUBLIC_ROUTES) {
    for (const locale of SITE_LOCALES) {
      const params = matchPattern(route[locale], clean);
      if (params) return { key: route.key, locale, params };
    }
  }
  return null;
}

/** Même page dans une autre langue (query conservée), ou null si la page n'est pas bilingue. */
export function alternatePath(pathname: string, search: string | URLSearchParams | null | undefined, target: SiteLocale): string | null {
  const route = routeOfPath(pathname);
  return route ? localizedPath(route.key, target, route.params, search) : null;
}

/** Versions linguistiques d'une page (pour hreflang et le sitemap) ; x-default = français. */
export function languageAlternates(key: PublicRouteKey, params: RouteParams = {}): Record<SiteLocale | "x-default", string> {
  const fr = localizedPath(key, "fr", params);
  return { fr, en: localizedPath(key, "en", params), "x-default": fr };
}
