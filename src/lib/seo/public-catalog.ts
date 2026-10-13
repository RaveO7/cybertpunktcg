/**
 * Catalogue public (pages /cartes et /en/cards) : cartes de jeu actives, hors produits scellés,
 * avec le contenu de la langue de la page (impression française si elle existe, sinon anglais).
 */

import { thumbnailPath } from "@/lib/card-image";
import { FRENCH_SOURCE_SET_CODE, isSealedSetCode, MAIN_SET_CODE } from "@/lib/reference-data";
import type { SiteLocale } from "@/lib/seo/routes";
import type { CardDTO, CatalogDTO, PrintingDTO } from "@/lib/types";

/** Types de produits scellés rangés parmi les cartes du catalogue. */
const SEALED_CARD_TYPES = new Set(["Sealed", "Lot"]);

export const COLOR_KEYS = ["Red", "Blue", "Green", "Yellow"] as const;
export const TYPE_KEYS = ["Legend", "Unit", "Program", "Gear"] as const;

export type PublicPrinting = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  language: string;
  artist: string | null;
  image: string | null;
  thumb: string | null;
  marketPrice: string | null;
};

export type PublicCard = {
  id: string;
  slug: string;
  /** Impression affichée (française si elle existe sur la fiche française), ouverte dans l'explorateur. */
  mainPrintingId: string | null;
  /** Nom dans la langue de la page (repli anglais). */
  name: string;
  /** Vrai si le nom et le texte viennent d'une impression dans la langue de la page. */
  translated: boolean;
  color: string | null;
  cardType: string | null;
  cost: number | null;
  power: number | null;
  ram: number | null;
  rulesText: string | null;
  flavorText: string | null;
  keywords: string[];
  tags: string[];
  image: string | null;
  thumb: string | null;
  artist: string | null;
  /** Prix de l'impression principale, sinon le plus bas des impressions. */
  marketPrice: string | null;
  printings: PublicPrinting[];
};

function collectorKey(value: string) {
  const beta = /^β/i.test(value) ? 1 : 0;
  const match = value.match(/(\d+)/);
  return { beta, number: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER, value };
}

function compareCollector(a: string, b: string) {
  const left = collectorKey(a);
  const right = collectorKey(b);
  if (left.beta !== right.beta) return left.beta - right.beta;
  if (left.number !== right.number) return left.number - right.number;
  return left.value.localeCompare(right.value);
}

function setRank(code: string) {
  if (code === MAIN_SET_CODE) return 0;
  if (code === FRENCH_SOURCE_SET_CODE) return 1;
  return 2;
}

function sortPrintingsForCard(list: PrintingDTO[]) {
  return [...list].sort((a, b) => setRank(a.setCode) - setRank(b.setCode) || compareCollector(a.collectorNumber, b.collectorNumber));
}

/** Carte de jeu publiable : active, d'un type jouable, avec au moins une impression hors scellés. */
export function isGameCard(card: CardDTO, printings: PrintingDTO[]) {
  if (card.cardType && SEALED_CARD_TYPES.has(card.cardType)) return false;
  return printings.some((printing) => !isSealedSetCode(printing.setCode));
}

function englishName(card: CardDTO) {
  return card.subname ? `${card.name}: ${card.subname}` : card.name;
}

function amount(value: string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPublicCard(card: CardDTO, printings: PrintingDTO[], locale: SiteLocale): PublicCard {
  const sorted = sortPrintingsForCard(printings.filter((printing) => !isSealedSetCode(printing.setCode)));
  const english = sorted.find((printing) => printing.language === "en") ?? sorted[0];
  const localized = locale === "fr" ? sorted.find((printing) => printing.language === "fr" && printing.localizedName) : undefined;
  const main = localized ?? english;
  const prices = sorted.map((printing) => amount(printing.marketPrice)).filter((value): value is number => value !== null);
  const mainPrice = amount(english?.marketPrice ?? null);
  return {
    id: card.id,
    slug: card.slug,
    mainPrintingId: main?.id ?? null,
    name: localized?.localizedName ?? englishName(card),
    translated: locale === "en" || Boolean(localized),
    color: card.color,
    cardType: card.cardType,
    cost: card.cost,
    power: card.power,
    ram: card.ram,
    rulesText: localized?.printedRulesText ?? card.rulesText,
    flavorText: localized ? null : card.flavorText,
    keywords: card.keywords,
    tags: card.tags,
    image: main?.imagePath ?? null,
    thumb: thumbnailPath(main?.imagePath) ?? main?.imagePath ?? null,
    artist: main?.artist ?? english?.artist ?? null,
    marketPrice: mainPrice !== null ? mainPrice.toFixed(2) : prices.length ? Math.min(...prices).toFixed(2) : null,
    printings: sorted.map((printing) => ({
      id: printing.id,
      setCode: printing.setCode,
      setName: printing.setName,
      collectorNumber: printing.collectorNumber,
      rarity: printing.rarity,
      language: printing.language,
      artist: printing.artist,
      image: printing.imagePath,
      thumb: thumbnailPath(printing.imagePath) ?? printing.imagePath,
      marketPrice: printing.marketPrice,
    })),
  };
}

/** Ordre du catalogue : numéro de collection de l'impression principale anglaise. */
function catalogOrder(card: PublicCard) {
  return card.printings.find((printing) => printing.language === "en") ?? card.printings[0];
}

/** Toutes les cartes publiques dans l'ordre du catalogue. */
export function publicCards(catalog: CatalogDTO, locale: SiteLocale): PublicCard[] {
  const byCard = new Map<string, PrintingDTO[]>();
  for (const printing of catalog.printings) {
    const list = byCard.get(printing.cardId);
    if (list) list.push(printing);
    else byCard.set(printing.cardId, [printing]);
  }
  return catalog.cards
    .filter((card) => isGameCard(card, byCard.get(card.id) ?? []))
    .map((card) => toPublicCard(card, byCard.get(card.id) ?? [], locale))
    .sort((a, b) => {
      const left = catalogOrder(a);
      const right = catalogOrder(b);
      return setRank(left.setCode) - setRank(right.setCode) || compareCollector(left.collectorNumber, right.collectorNumber) || a.slug.localeCompare(b.slug);
    });
}

export type CatalogFilters = { color?: string; type?: string };

export function filterCards(cards: PublicCard[], filters: CatalogFilters) {
  return cards.filter((card) => (!filters.color || card.color === filters.color) && (!filters.type || card.cardType === filters.type));
}

/** Fiche d'une carte et ses liens : précédente, suivante et jusqu'à 6 cartes de la même couleur. */
export function cardWithNeighbours(cards: PublicCard[], slug: string) {
  const index = cards.findIndex((card) => card.slug === slug);
  if (index === -1) return null;
  const card = cards[index];
  const sameColor = card.color
    ? cards.filter((other, position) => other.color === card.color && other.slug !== card.slug && Math.abs(position - index) > 1)
    : [];
  // Cartes de la même couleur les plus proches dans l'ordre du catalogue.
  sameColor.sort((a, b) => Math.abs(cards.indexOf(a) - index) - Math.abs(cards.indexOf(b) - index));
  return {
    card,
    previous: index > 0 ? cards[index - 1] : null,
    next: index < cards.length - 1 ? cards[index + 1] : null,
    sameColor: sameColor.slice(0, 6),
  };
}
