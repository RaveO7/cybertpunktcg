import type { Locale } from "@/i18n/config";
import { alternatePath, localizedPath } from "@/i18n/paths";
import { markLocaleSwitching, writeLocalePreference } from "@/i18n/preference";

/**
 * Choisir une langue (sélecteur, paramètres) : l'enregistrer, puis ouvrir la même page dans cette
 * langue (query et ancre conservées). La page est rechargée : messages, dates et métadonnées sont
 * rendus par le serveur dans la nouvelle langue.
 */
export function chooseLocale(next: Locale) {
  markLocaleSwitching();
  writeLocalePreference(next);
  const { pathname, search, hash } = window.location;
  // Rechargement complet voulu : messages, métadonnées et `<html lang>` doivent venir du serveur.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${alternatePath(pathname, search, next) ?? localizedPath("home", next)}${hash}`);
}
