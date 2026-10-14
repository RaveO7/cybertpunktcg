// Langue à proposer à un visiteur d'une page publique bilingue, d'après le pays d'où il se connecte.

import type { SiteLocale } from "@/lib/seo/routes";

/** Cookie posé par le proxy depuis l'en-tête de géolocalisation de Vercel (code ISO 3166-1 alpha-2). */
export const COUNTRY_COOKIE = "cptcg-country";

/** Pays où le français est la langue courante du site : France, outre-mer, Monaco, Afrique francophone. */
const FRENCH_COUNTRIES = new Set([
  "FR", "MC", "RE", "GP", "MQ", "GF", "YT", "PM", "BL", "MF", "NC", "PF", "WF",
  "MA", "DZ", "TN", "SN", "CI", "ML", "BF", "NE", "TG", "BJ", "GN", "GA", "CG", "CD", "CM", "CF", "TD",
  "MG", "DJ", "KM", "BI", "HT",
]);

/** Pays bilingues (ou plus) : le pays ne tranche pas, la langue du navigateur décide. */
const MIXED_COUNTRIES = new Set(["BE", "CH", "LU", "CA"]);

export function isCountryCode(value: string | null | undefined): value is string {
  return !!value && /^[A-Z]{2}$/.test(value);
}

/**
 * Langue du site à proposer : celle choisie dans l'app si c'est le français ou l'anglais, sinon celle
 * du pays de connexion, sinon celle du navigateur. Une autre langue de l'app (allemand…) donne l'anglais.
 */
export function suggestedSiteLocale({
  stored,
  country,
  languages,
}: {
  stored: string | null;
  country: string | null;
  languages: readonly string[];
}): SiteLocale {
  if (stored === "fr" || stored === "en") return stored;
  if (stored) return "en";
  const browser: SiteLocale = languages.some((language) => language.toLowerCase().startsWith("fr")) ? "fr" : "en";
  if (!isCountryCode(country) || MIXED_COUNTRIES.has(country)) return browser;
  return FRENCH_COUNTRIES.has(country) ? "fr" : "en";
}
