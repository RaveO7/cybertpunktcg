/** Nom du cookie de session, sans dépendance : lisible depuis le proxy comme depuis le serveur. */
export const SESSION_COOKIE = "cptcg_session";

/**
 * Indicateur lisible par le script du <head> (le cookie de session est httpOnly) : posé et retiré par le
 * proxy selon la présence du cookie de session. Sans secret ni droit : l'API vérifie toujours la session.
 */
export const SESSION_HINT_COOKIE = "cptcg_signed";
