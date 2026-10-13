import { NextResponse, type NextRequest } from "next/server";
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
  if (!target || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/tournois/publics", "/boutiques", "/comment-jouer"],
};
