// Endpoints Web Push acceptés. Le serveur POSTe vers cette URL à chaque alerte : sans liste fermée,
// un compte pourrait faire viser au serveur une adresse interne (SSRF).

/** Hôtes exacts des services push des navigateurs (Chrome et Edge : FCM ; Firefox : autopush). */
const EXACT_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com"]);
/** Domaines dont tous les sous-domaines sont acceptés (Safari : web.push.apple.com ; Edge/Windows : WNS). */
const DOMAIN_SUFFIXES = ["push.apple.com", "notify.windows.com"];

/**
 * HTTPS, sans identifiants ni port, sur un hôte de service push connu. Une adresse IP littérale ne
 * correspond jamais à un nom de domaine de la liste.
 */
export function isAllowedPushEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || DOMAIN_SUFFIXES.some((suffix) => host.endsWith(`.${suffix}`));
}
