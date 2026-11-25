import {
  COLOR_ORDER,
  RARITY_ORDER,
  TYPE_ORDER,
} from "@/lib/reference-data";
import type {
  CardDTO,
  Ownership,
  PrintingDTO,
  SetDTO,
  SortKey,
} from "@/lib/types";
import { printingSearchEntry, rankBySearch } from "@/lib/cards/search";
import { ownershipOf } from "@/lib/cards/collection-stats";

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function rank(order: readonly string[], value: string | null) {
  if (!value) return order.length + 1;
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

function collectorRank(value: string) {
  const beta = /^β/i.test(value) ? 1 : 0;
  const match = value.match(/(\d+)/);
  const number = match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  return { beta, number, value };
}

function displayName(card: CardDTO, printing: PrintingDTO) {
  return printing.localizedName || card.canonicalName || card.name;
}

function compareDefault(a: PrintingDTO, b: PrintingDTO, cards: Map<string, CardDTO>) {
  const cardA = cards.get(a.cardId);
  const cardB = cards.get(b.cardId);
  const color = rank(COLOR_ORDER, cardA?.color ?? null) - rank(COLOR_ORDER, cardB?.color ?? null);
  if (color !== 0) return color;
  const type = rank(TYPE_ORDER, cardA?.cardType ?? null) - rank(TYPE_ORDER, cardB?.cardType ?? null);
  if (type !== 0) return type;
  const cost = (cardA?.cost ?? 0) - (cardB?.cost ?? 0);
  if (cost !== 0) return cost;
  const name = collator.compare(displayName(cardA ?? emptyCard(a.cardId), a), displayName(cardB ?? emptyCard(b.cardId), b));
  if (name !== 0) return name;
  return compareNumber(a, b);
}

function compareNumber(a: PrintingDTO, b: PrintingDTO) {
  const left = collectorRank(a.collectorNumber);
  const right = collectorRank(b.collectorNumber);
  if (left.beta !== right.beta) return left.beta - right.beta;
  if (left.number !== right.number) return left.number - right.number;
  return collator.compare(left.value, right.value);
}

/** Prix Cardmarket actuel (même valeur que le modal aria-live), nulls en fin de liste. */
export function marketAmount(printing: PrintingDTO) {
  if (printing.marketPrice == null || printing.marketPrice === "") return null;
  const amount = Number(printing.marketPrice);
  return Number.isFinite(amount) ? amount : null;
}

/** Valeurs absentes en fin de liste dans les deux sens ; égalités départagées par le numéro. */
function compareValues(a: PrintingDTO, b: PrintingDTO, valueA: number | null, valueB: number | null, direction: 1 | -1) {
  if (valueA == null && valueB == null) return compareNumber(a, b);
  if (valueA == null) return 1;
  if (valueB == null) return -1;
  const diff = (valueA - valueB) * direction;
  if (diff !== 0) return diff;
  return compareNumber(a, b);
}

/** Tris sur une caractéristique de jeu de la carte : [caractéristique, sens]. */
const CARD_STAT_SORTS: Partial<Record<SortKey, ["cost" | "power" | "ram", 1 | -1]>> = {
  "play-cost-asc": ["cost", 1],
  "play-cost-desc": ["cost", -1],
  "power-asc": ["power", 1],
  "power-desc": ["power", -1],
  "ram-asc": ["ram", 1],
  "ram-desc": ["ram", -1],
};

/**
 * Cartes de la liste dont le numéro de collection est entre ceux des deux cartes, bornes incluses et dans
 * n'importe quel ordre ; même ordre que le tri par numéro (#001 à #005a ne prend pas #005b).
 */
export function collectorRangeIds(list: PrintingDTO[], anchorId: string, endId: string) {
  const anchor = list.find((printing) => printing.id === anchorId);
  const end = list.find((printing) => printing.id === endId);
  if (!anchor || !end) return [];
  const [low, high] = compareNumber(anchor, end) <= 0 ? [anchor, end] : [end, anchor];
  return list
    .filter((printing) => compareNumber(printing, low) >= 0 && compareNumber(printing, high) <= 0)
    .map((printing) => printing.id);
}

function emptyCard(id: string): CardDTO {
  return {
    id,
    externalId: "",
    slug: "",
    name: "",
    subname: null,
    canonicalName: "",
    rulesText: null,
    flavorText: null,
    color: null,
    cardType: null,
    isEddiable: null,
    cost: null,
    power: null,
    ram: null,
    tags: [],
    keywords: [],
  };
}

export function sortPrintings(
  printings: PrintingDTO[],
  cards: Map<string, CardDTO>,
  agg: Map<string, Ownership>,
  sets: Map<string, SetDTO>,
  sort: SortKey,
  /** Saisie en cours et tri par défaut de l'écran : avec ce tri, les résultats sont classés par pertinence. */
  search?: { q: string; defaultSort: SortKey },
) {
  const sorted = sortPrintingsBy(printings, cards, agg, sets, sort);
  if (!search || sort !== search.defaultSort) return sorted;
  return rankBySearch(sorted, search.q, (printing) => {
    const card = cards.get(printing.cardId);
    return card ? printingSearchEntry(card, printing) : null;
  });
}

function sortPrintingsBy(
  printings: PrintingDTO[],
  cards: Map<string, CardDTO>,
  agg: Map<string, Ownership>,
  sets: Map<string, SetDTO>,
  sort: SortKey,
) {
  const list = [...printings];
  list.sort((a, b) => {
    if (sort === "owned-first" || sort === "missing-first") {
      const ownedA = ownershipOf(a.id, agg).qty > 0 ? 1 : 0;
      const ownedB = ownershipOf(b.id, agg).qty > 0 ? 1 : 0;
      const diff = sort === "owned-first" ? ownedB - ownedA : ownedA - ownedB;
      if (diff !== 0) return diff;
      return compareDefault(a, b, cards);
    }
    if (sort === "number-asc") return compareNumber(a, b);
    if (sort === "number-desc") return compareNumber(b, a);
    if (sort === "price-asc" || sort === "price-desc") {
      return compareValues(a, b, marketAmount(a), marketAmount(b), sort === "price-asc" ? 1 : -1);
    }
    const stat = CARD_STAT_SORTS[sort];
    if (stat) {
      const [key, direction] = stat;
      return compareValues(a, b, cards.get(a.cardId)?.[key] ?? null, cards.get(b.cardId)?.[key] ?? null, direction);
    }
    if (sort === "qty-asc" || sort === "qty-desc") {
      const diff = ownershipOf(a.id, agg).qty - ownershipOf(b.id, agg).qty;
      if (diff !== 0) return sort === "qty-asc" ? diff : -diff;
      return compareNumber(a, b);
    }
    if (sort === "name-asc" || sort === "name-desc") {
      const cardA = cards.get(a.cardId) ?? emptyCard(a.cardId);
      const cardB = cards.get(b.cardId) ?? emptyCard(b.cardId);
      const diff = collator.compare(displayName(cardA, a), displayName(cardB, b));
      return sort === "name-asc" ? diff : -diff;
    }
    if (sort === "rarity") {
      const diff = rank(RARITY_ORDER, a.rarity) - rank(RARITY_ORDER, b.rarity);
      if (diff !== 0) return diff;
      return compareNumber(a, b);
    }
    if (sort === "set") {
      const setA = sets.get(a.setCode)?.sortOrder ?? 999;
      const setB = sets.get(b.setCode)?.sortOrder ?? 999;
      if (setA !== setB) return setA - setB;
      return compareNumber(a, b);
    }
    return compareDefault(a, b, cards);
  });
  return list;
}
