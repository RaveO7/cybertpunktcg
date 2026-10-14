import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY_COOKIE, isCountryCode } from "@/lib/i18n/geo-locale";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Annuaires et règles réservés aux comptes : un visiteur sans session est renvoyé vers l'accueil, qui
 * présente les tournois et les boutiques. Fait ici et non dans la page, parce que RequireUser (client)
 * afficherait l'écran de connexion sans jamais rendre la redirection de la page.
 */
const GUEST_TARGETS: Record<string, string> = {
  "/tournois/publics": "/#tournois",
  "/boutiques": "/#boutiques",
  "/comment-jouer": "/",
};

export function proxy(request: NextRequest) {
  const target = GUEST_TARGETS[request.nextUrl.pathname];
  const response =
    target && !request.cookies.has(SESSION_COOKIE) ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();

  // Pays de connexion (fourni par Vercel) transmis au navigateur, qui propose dès le chargement la
  // version française ou anglaise de la page. Les pages restent statiques : rien n'est rendu côté serveur.
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
