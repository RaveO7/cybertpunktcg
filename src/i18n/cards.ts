import type { Locale } from "@/i18n/config";

/**
 * Traductions du texte de règles des cartes par le site (langues sans impression officielle) :
 * src/i18n/cards/<langue>.json, `{ slug: { source, text } }`. `source` est le texte anglais traduit :
 * une traduction n'est utilisée que s'il est identique au texte anglais actuel de la carte.
 */
export type CardTranslation = { source: string; text: string };
export type CardTranslations = Record<string, CardTranslation>;

/** Langue du texte de règles de référence des cartes (base de données). */
export const CARD_TEXT_LOCALE: Locale = "en";

export async function loadCardTranslations(locale: Locale): Promise<CardTranslations> {
  try {
    return (await import(`./cards/${locale}.json`)).default as CardTranslations;
  } catch {
    return {};
  }
}

/** Traduction à jour du texte d'une carte, ou null (absente, ou texte anglais modifié depuis). */
export function translatedRulesText(translations: CardTranslations, slug: string, rulesText: string | null): string | null {
  const entry = translations[slug];
  return entry && rulesText !== null && entry.source === rulesText ? entry.text : null;
}

/** État de la traduction d'une carte : à jour, périmée (texte anglais modifié) ou absente. */
export function translationStatus(translations: CardTranslations, slug: string, rulesText: string | null): "ok" | "stale" | "missing" {
  const entry = translations[slug];
  if (!entry) return "missing";
  return entry.source === rulesText ? "ok" : "stale";
}
