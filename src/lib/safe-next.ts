/**
 * Chemin de retour après connexion (`?next=`) : uniquement un chemin relatif du site, jamais une
 * URL absolue ni « //domaine » (redirection ouverte). Défaut : l'accueil.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  // Caractères de contrôle et barres obliques inverses : interprétés différemment selon les navigateurs.
  if (/[\u0000-\u001f\\]/.test(value)) return "/";
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return "/";
    if (url.pathname === "/connexion") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
