// Pays proposés à la saisie d'une adresse. Les noms viennent d'Intl.DisplayNames : ils
// suivent la langue de l'app sans traduction à maintenir.

import { intlLocale } from "@/lib/i18n/messages";

export const COUNTRY_CODES = [
  "FR", "BE", "CH", "LU", "MC", "DE", "AT", "NL", "IT", "ES", "PT", "GB", "IE", "DK", "SE", "NO", "FI", "PL", "CZ",
  "SK", "HU", "RO", "BG", "GR", "HR", "SI", "EE", "LV", "LT", "IS", "MT", "CY", "AD", "US", "CA", "MX", "BR", "AR",
  "CL", "JP", "KR", "CN", "TW", "HK", "SG", "AU", "NZ", "MA", "TN", "DZ", "SN", "CI", "RE", "GP", "MQ", "NC", "PF",
] as const;

export function countryName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Clé de tri d'un nom : minuscules, sans accents, comparée caractère par caractère. localeCompare
 * dépend de l'ICU embarqué, qui ne classe pas pareil les espaces (« Hong Kong » / « Hongrie ») dans
 * Node et dans les navigateurs ; l'ordre est ainsi le même partout.
 */
function sortKey(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Pays triés par nom dans la langue affichée, la France en tête. Même ordre côté serveur et client. */
export function countryOptions(locale: string, extra: readonly string[] = []) {
  const codes = [...new Set([...COUNTRY_CODES, ...extra])];
  const named = codes.map((code) => {
    const name = countryName(code, locale);
    return { code, name, key: sortKey(name) };
  });
  const [france, rest] = [named.filter((entry) => entry.code === "FR"), named.filter((entry) => entry.code !== "FR")];
  rest.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.code < b.code ? -1 : 1));
  return [...france, ...rest].map(({ code, name }) => ({ code, name }));
}
