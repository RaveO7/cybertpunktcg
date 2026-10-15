// Langue à proposer à un visiteur d'une page publique, d'après sa préférence, son pays et son navigateur.

import { INTERNATIONAL_LOCALE, isLocale, localeOfCountry, MIXED_COUNTRIES, type Locale } from "@/i18n/config";

/** Cookie posé par le proxy depuis l'en-tête de géolocalisation de Vercel (code ISO 3166-1 alpha-2). */
export const COUNTRY_COOKIE = "cptcg-country";

/** Langue du site d'un code de langue du navigateur (« de-AT » → de), ou null. */
function siteLocaleOf(language: string): Locale | null {
  const code = language.toLowerCase().slice(0, 2);
  return isLocale(code) ? code : null;
}

export function isCountryCode(value: string | null | undefined): value is string {
  return !!value && /^[A-Z]{2}$/.test(value);
}

/**
 * Langue du site à proposer : celle choisie par l'utilisateur, sinon celle du pays de connexion, sinon
 * la première langue du navigateur que le site propose, sinon l'anglais.
 */
export function suggestedSiteLocale({
  stored,
  country,
  languages,
}: {
  stored: string | null;
  country: string | null;
  languages: readonly string[];
}): Locale {
  if (isLocale(stored)) return stored;
  const browser = languages.map(siteLocaleOf).find((locale) => locale !== null) ?? INTERNATIONAL_LOCALE;
  if (!isCountryCode(country) || MIXED_COUNTRIES.includes(country)) return browser;
  return localeOfCountry(country) ?? INTERNATIONAL_LOCALE;
}

/**
 * Langue à suggérer sur une page affichée en `current` : celle du visiteur (cf. suggestedSiteLocale)
 * si elle diffère de la page et que le visiteur n'a pas refusé cette suggestion ; sinon null.
 */
export function languageSuggestion({
  current,
  preference,
  country,
  languages,
  dismissed,
}: {
  current: Locale;
  preference: string | null;
  country: string | null;
  languages: readonly string[];
  dismissed: (locale: Locale) => boolean;
}): Locale | null {
  const suggested = suggestedSiteLocale({ stored: preference, country, languages });
  return suggested === current || dismissed(suggested) ? null : suggested;
}
