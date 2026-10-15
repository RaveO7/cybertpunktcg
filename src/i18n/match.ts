/**
 * Correspondance entre une URL et une route de src/i18n/routing.ts, sans dépendance à React ni à
 * Next : utilisable par le proxy. Seuls les gabarits de la langue de l'URL sont essayés (« /cards »
 * est l'explorateur en français mais la liste des cartes en anglais).
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { pathnames, type AppPathname } from "@/i18n/routing";

export type RouteParams = Record<string, string>;

export type MatchedRoute = { locale: Locale; route: AppPathname; params: RouteParams };

const ROUTES = Object.keys(pathnames) as AppPathname[];

/** Gabarit d'URL d'une route dans une langue, sans préfixe (« /karten/[slug] »). */
export function templateFor(route: AppPathname, locale: Locale): string {
  const config = pathnames[route];
  return typeof config === "string" ? config : config[locale];
}

/** Langue d'une URL et reste du chemin : « /de/karten/x » → de, « /karten/x » ; « /cartes » → fr. */
export function splitLocale(pathname: string): { locale: Locale; rest: string; prefixed: boolean } {
  const [, first = "", ...others] = pathname.split("/");
  if (isLocale(first)) return { locale: first, rest: `/${others.join("/")}`, prefixed: true };
  return { locale: DEFAULT_LOCALE, rest: pathname || "/", prefixed: false };
}

function segments(path: string) {
  return path.split("/").filter(Boolean);
}

function matchTemplate(template: string, path: string): RouteParams | null {
  const expected = segments(template);
  const actual = segments(path);
  if (expected.length !== actual.length) return null;
  const params: RouteParams = {};
  for (let index = 0; index < expected.length; index += 1) {
    const dynamic = /^\[(\w+)\]$/.exec(expected[index]);
    if (dynamic) {
      try {
        params[dynamic[1]] = decodeURIComponent(actual[index]);
      } catch {
        return null;
      }
    } else if (expected[index] !== actual[index]) {
      return null;
    }
  }
  return params;
}

function staticSegments(template: string) {
  return segments(template).filter((segment) => !segment.startsWith("[")).length;
}

/** Route d'une URL dans la langue de l'URL (« /it/carte/v » → /cartes/[slug], it), ou null. */
export function matchRoute(pathname: string): MatchedRoute | null {
  const { locale, rest } = splitLocale(pathname);
  let best: MatchedRoute | null = null;
  let bestScore = -1;
  for (const route of ROUTES) {
    const template = templateFor(route, locale);
    const params = matchTemplate(template, rest);
    // Segments fixes prioritaires : « /tournois/publics » plutôt que « /tournois/[id] ».
    if (params && staticSegments(template) > bestScore) {
      best = { locale, route, params };
      bestScore = staticSegments(template);
    }
  }
  return best;
}

/**
 * Route d'un chemin interne préfixé par sa langue (« /de/cartes/x », URL réécrite par le proxy), ou
 * null. Les dossiers de src/app/[locale] portent les segments français.
 */
export function matchInternalPath(pathname: string): MatchedRoute | null {
  const { locale, rest, prefixed } = splitLocale(pathname);
  if (!prefixed) return null;
  const french = matchRoute(rest);
  return french && french.locale === DEFAULT_LOCALE ? { ...french, locale } : null;
}

/** Chemin interne d'une route (segments français, sans préfixe) : « /cartes/[slug] » → « /cartes/x ». */
export function internalPath(route: AppPathname, params: RouteParams = {}): string {
  return (route as string).replace(/\[(\w+)\]/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
}

/** URL d'une route dans une langue (préfixe hors français, paramètres encodés). */
export function formatRoute(route: AppPathname, locale: Locale, params: RouteParams = {}): string {
  const path = templateFor(route, locale).replace(/\[(\w+)\]/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Paramètre manquant : ${name}`);
    return encodeURIComponent(value);
  });
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
