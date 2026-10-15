import type { Locale } from "@/i18n/config";
import { loadMessages } from "@/i18n/load";

/** Types de carte du jeu, dans l'ordre des sections de la liste des cartes. */
export const CARD_TYPES = ["Legend", "Unit", "Program", "Gear"] as const;

export type CardLabels = {
  /** « Légende » (code anglais de la base → libellé de la langue), ou le code s'il est inconnu. */
  type: (code: string | null) => string | null;
  /** « Légendes ». */
  typePlural: (code: string) => string;
  /** « Rouge ». */
  color: (code: string | null) => string | null;
};

/** Libellés des types et couleurs de carte d'une langue (bloc catalog). */
export async function cardLabels(locale: Locale): Promise<CardLabels> {
  const { catalog } = await loadMessages(locale);
  const types: Record<string, string> = catalog.types;
  const plurals: Record<string, string> = catalog.typePlurals;
  const colors: Record<string, string> = catalog.colors;
  return {
    type: (code) => (code ? (types[code] ?? code) : null),
    typePlural: (code) => plurals[code] ?? code,
    color: (code) => (code ? (colors[code] ?? code) : null),
  };
}
