import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { INTERNATIONAL_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { formatRoute, internalPath, matchRoute, splitLocale, type MatchedRoute } from "@/i18n/match";
import { landingSections, routing, type AppPathname } from "@/i18n/routing";
import { COUNTRY_COOKIE, isCountryCode } from "@/lib/i18n/geo-locale";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Préfixes de langue, chemins traduits et URL inconnues : gérés par next-intl. */
const handleI18nRouting = createMiddleware(routing);

/**
 * Annuaires et règles réservés aux comptes : un visiteur sans session est renvoyé vers l'accueil (dans
 * la langue de l'URL), qui présente les tournois et les boutiques. Fait ici et non dans la page, parce
 * que RequireUser (client) afficherait l'écran de connexion sans jamais rendre la redirection.
 */
const GUEST_TARGETS: Partial<Record<AppPathname, (locale: Locale) => string>> = {
  "/tournois/publics": (locale) => `${formatRoute("/", locale)}#${landingSections[locale].tournaments}`,
  "/boutiques": (locale) => `${formatRoute("/", locale)}#${landingSections[locale].shops}`,
  "/comment-jouer": (locale) => formatRoute("/", locale),
};

function redirect(request: NextRequest, path: string, status: 307 | 308) {
  return NextResponse.redirect(new URL(path, request.url), status);
}

/** URL interne (dossier de src/app/[locale]) d'une page : « /de/karten/x » → « /de/cartes/x ». */
function internalUrl(request: NextRequest, match: MatchedRoute) {
  const path = internalPath(match.route, match.params);
  const url = request.nextUrl.clone();
  url.pathname = path === "/" ? `/${match.locale}` : `/${match.locale}${path}`;
  return url;
}

function route(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  // Correspondance dans la langue de l'URL : « /fr/cards » est l'explorateur, la liste des cartes
  // sous « /en/cards ».
  // Lien sans langue : renvoi définitif vers la même page en anglais, qu'il utilise les segments anglais
  // (« /cards/x ») ou les anciens segments français (« /cartes/x ») ; sinon « /en » + le chemin (404).
  if (!splitLocale(pathname).prefixed) {
    const target = INTERNATIONAL_LOCALE;
    const found = matchRoute(pathname === "/" ? `/${target}` : `/${target}${pathname}`) ?? matchRoute(pathname);
    const destination = found ? formatRoute(found.route, target, found.params) : `/${target}${pathname}`;
    return redirect(request, `${destination}${search}`, 308);
  }

  const match = matchRoute(pathname);

  if (match) {
    const hasSession = request.cookies.has(SESSION_COOKIE);
    const guestTarget = GUEST_TARGETS[match.route];
    if (guestTarget && !hasSession) return redirect(request, guestTarget(match.locale), 307);

    // Utilisateur connecté sur une page dans une autre langue que celle qu'il a choisie : même page dans
    // sa langue. Les visiteurs et les robots ne sont jamais redirigés.
    const preferred = request.cookies.get(LOCALE_COOKIE)?.value;
    if (hasSession && isLocale(preferred) && preferred !== match.locale) {
      return redirect(request, `${formatRoute(match.route, preferred, match.params)}${search}`, 307);
    }

    const headers = new Headers(request.headers);
    headers.set("X-NEXT-INTL-LOCALE", match.locale);
    return NextResponse.rewrite(internalUrl(request, match), { request: { headers } });
  }

  // Chemin d'une autre langue (« /de/cards/x » → « /de/karten/x »), URL sans langue ou URL inconnue
  // (404). Les redirections de next-intl sont définitives : ce sont des adresses en double.
  const response = handleI18nRouting(request);
  const location = response.headers.get("location");
  if (location && response.status === 307) return NextResponse.redirect(location, 308);
  return response;
}

export function proxy(request: NextRequest) {
  const response = route(request);

  // Pays de connexion (fourni par Vercel) transmis au navigateur, qui propose dès le chargement la
  // version de la page dans la langue du visiteur.
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (isCountryCode(country) && request.cookies.get(COUNTRY_COOKIE)?.value !== country) {
    response.cookies.set(COUNTRY_COOKIE, country, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export const config = {
  // Pages seulement : ni API, ni ressources de Next, ni images de partage, ni fichiers statiques.
  matcher: ["/((?!api/|_next/|og/|.*\\.[a-zA-Z0-9]+$).*)"],
};
