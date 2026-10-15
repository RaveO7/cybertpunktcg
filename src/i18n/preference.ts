import { isLocale, LEGACY_LOCALE_STORAGE_KEY, LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * Langue choisie par l'utilisateur (sélecteur, paramètres) : cookie d'un an, lu aussi par le proxy.
 * Les composants s'abonnent aux changements (useSyncExternalStore).
 */

const ONE_YEAR = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();
let switching = false;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeLocalePreference(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Langue choisie par l'utilisateur, ou null. */
export function readLocalePreference(): Locale | null {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  const value = entry ? decodeURIComponent(entry.slice(LOCALE_COOKIE.length + 1)) : null;
  return isLocale(value) ? value : null;
}

/** Enregistre la langue choisie pour un an. */
export function writeLocalePreference(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
  notify();
}

/**
 * Reprise de la préférence enregistrée par l'ancienne version du site (localStorage) : recopiée une
 * fois dans le cookie s'il n'existe pas. La valeur du localStorage n'est pas effacée (retour arrière
 * possible) mais n'est plus lue ensuite. Renvoie la langue reprise, ou null.
 */
export function migrateLegacyLocalePreference(): Locale | null {
  if (readLocalePreference()) return null;
  let legacy: string | null = null;
  try {
    legacy = window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!isLocale(legacy)) return null;
  writeLocalePreference(legacy);
  return legacy;
}

/** Un changement de langue est en cours (la page va être remplacée) : rien ne doit s'afficher entre-temps. */
export function isLocaleSwitching() {
  return switching;
}

/** Marque le début d'un changement de langue. */
export function markLocaleSwitching() {
  switching = true;
  notify();
}
