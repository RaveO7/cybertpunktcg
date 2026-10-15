/**
 * Registre des langues du site : seule liste des langues prises en charge. Le routage, le sélecteur,
 * les balises hreflang, le sitemap, les images de partage et la suggestion de langue en dérivent.
 *
 * Ajouter une langue : une entrée ici, un dossier src/i18n/messages/<code>/ et ses segments d'URL dans
 * src/i18n/routing.ts (voir src/i18n/README.md).
 */

export type LanguageDefinition = {
  /** Code de langue, aussi préfixe d'URL (« /de »). */
  code: string;
  /** Nom affiché, écrit dans la langue elle-même. */
  label: string;
  /** Format régional des dates, prix et nombres. */
  intl: string;
  /** Locale Open Graph (`og:locale`). */
  ogLocale: string;
  /** Pays (ISO 3166-1 alpha-2) où cette langue est proposée aux visiteurs. */
  countries: readonly string[];
};

export const LANGUAGES = [
  {
    code: "fr",
    label: "Français",
    intl: "fr-FR",
    ogLocale: "fr_FR",
    // France, outre-mer, Monaco, Afrique francophone.
    countries: [
      "FR", "MC", "RE", "GP", "MQ", "GF", "YT", "PM", "BL", "MF", "NC", "PF", "WF",
      "MA", "DZ", "TN", "SN", "CI", "ML", "BF", "NE", "TG", "BJ", "GN", "GA", "CG", "CD", "CM", "CF", "TD",
      "MG", "DJ", "KM", "BI", "HT",
    ],
  },
  { code: "en", label: "English", intl: "en-US", ogLocale: "en_US", countries: [] },
  { code: "de", label: "Deutsch", intl: "de-DE", ogLocale: "de_DE", countries: ["DE", "AT", "LI"] },
  {
    code: "es",
    label: "Español",
    intl: "es-ES",
    ogLocale: "es_ES",
    // Espagne et Amérique latine.
    countries: [
      "ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "PR", "GQ",
    ],
  },
  { code: "it", label: "Italiano", intl: "it-IT", ogLocale: "it_IT", countries: ["IT", "SM", "VA"] },
] as const satisfies readonly LanguageDefinition[];

export type Locale = (typeof LANGUAGES)[number]["code"];

/** Codes des langues, dans l'ordre du registre. */
export const LOCALES = LANGUAGES.map((language) => language.code) as readonly Locale[];

/** Langue par défaut et langue de référence des textes. */
export const DEFAULT_LOCALE: Locale = "fr";

/** Langue de repli quand un texte manque dans une langue (avant le français). */
export const FALLBACK_LOCALE: Locale = "en";

/** Langue d'un visiteur dont le pays ne correspond à aucune langue du site. */
export const INTERNATIONAL_LOCALE: Locale = "en";

/** Cookie de la langue choisie par l'utilisateur (sélecteur, paramètres). */
export const LOCALE_COOKIE = "cptcg-locale";

/** Ancienne clé localStorage de la préférence de langue (reprise une fois dans le cookie). */
export const LEGACY_LOCALE_STORAGE_KEY = "cptcg-locale";

/** Pays multilingues : le pays ne tranche pas, la langue du navigateur décide. */
export const MIXED_COUNTRIES: readonly string[] = ["BE", "CH", "LU", "CA"];

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function language(locale: Locale) {
  return LANGUAGES.find((entry) => entry.code === locale)!;
}

/** Format régional d'une langue (« de-DE »), français par défaut. */
export function intlLocale(locale: string): string {
  return isLocale(locale) ? language(locale).intl : language(DEFAULT_LOCALE).intl;
}

/** Locale Open Graph de chaque langue. */
export const OG_LOCALE = Object.fromEntries(LANGUAGES.map((entry) => [entry.code, entry.ogLocale])) as Record<Locale, string>;

/** Langue proposée aux visiteurs d'un pays, ou null si le pays n'en désigne aucune. */
export function localeOfCountry(country: string): Locale | null {
  return LANGUAGES.find((entry) => (entry.countries as readonly string[]).includes(country))?.code ?? null;
}
