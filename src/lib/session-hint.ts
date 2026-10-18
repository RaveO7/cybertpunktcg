/*
 * Session mémorisée sur l'appareil (cf. specs/account/session) : informations d'affichage du compte,
 * reprises au démarrage pour montrer l'espace du compte sans attendre le serveur. Ce n'est pas une
 * preuve d'authentification : le cookie de session reste seul juge.
 */
import type { AuthUser } from "@/lib/types";

export const SESSION_USER_KEY = "cptcg-session-user";
/** Ancien indice booléen « session ouverte », remplacé par la session mémorisée. */
export const LEGACY_SIGNED_IN_KEY = "cptcg-signed-in";

export type HintStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    user.id.length > 0 &&
    typeof user.displayName === "string" &&
    typeof user.email === "string"
  );
}

/** Utilisateur mémorisé, ou `null` si absent, illisible ou stockage indisponible. */
export function readSessionUser(storage: HintStorage | null | undefined): AuthUser | null {
  try {
    const raw = storage?.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isAuthUser(parsed)) return null;
    return { id: parsed.id, displayName: parsed.displayName, email: parsed.email };
  } catch {
    return null;
  }
}

export function writeSessionUser(storage: HintStorage | null | undefined, user: AuthUser) {
  try {
    storage?.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ id: user.id, displayName: user.displayName, email: user.email }),
    );
  } catch {
    // Stockage indisponible (navigation privée…) : le démarrage attendra la vérification.
  }
  try {
    storage?.removeItem(LEGACY_SIGNED_IN_KEY);
  } catch {
    // Idem.
  }
}

export function clearSessionUser(storage: HintStorage | null | undefined) {
  for (const key of [SESSION_USER_KEY, LEGACY_SIGNED_IN_KEY]) {
    try {
      storage?.removeItem(key);
    } catch {
      // Stockage indisponible : rien à effacer.
    }
  }
}

/** `window.localStorage`, ou `null` hors navigateur ou quand son accès lève. */
export function browserStorage(): HintStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
