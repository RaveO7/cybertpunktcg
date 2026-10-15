import { matchRoute } from "@/i18n/match";

/**
 * Chemin de retour après connexion (`?next=`) : uniquement un chemin relatif du site, jamais une
 * URL absolue ni « //domaine » (redirection ouverte). Défaut : `fallback` (l'accueil).
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Caractères de contrôle et barres obliques inverses : interprétés différemment selon les navigateurs.
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    // Écran de connexion, dans n'importe quelle langue : pas de boucle.
    if (matchRoute(url.pathname)?.route === "/connexion") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
