// Règles de construction de deck (cf. « Construction de deck & RAM » dans src/lib/rules/howto-play.ts)
// et comparaison avec la collection. Module pur : utilisé par l'écran des decks et les tests.
import { COLOR_ORDER, TYPE_ORDER } from "./reference-data";
import { normalizeText } from "./logic";
import type { CardDTO, CollectionItemDTO, PrintingDTO } from "./types";

export const DECK_RULES = { legends: 3, minCards: 40, maxCards: 50, maxCopies: 3 } as const;

/** Produits scellés et lots : présents au catalogue mais pas jouables. */
const NON_DECK_TYPES = new Set(["Sealed", "Lot"]);

export type DeckEntry = { cardId: string; quantity: number };

export type DeckLine = { card: CardDTO; quantity: number };

export type DeckIssue =
  | { code: "legend-count"; count: number }
  | { code: "legend-name"; name: string }
  | { code: "deck-size"; count: number }
  | { code: "copies"; cardId: string; name: string; quantity: number }
  | { code: "ram"; cardId: string; name: string; color: string; ram: number; limit: number }
  | { code: "not-legal"; cardId: string; name: string }
  | { code: "unknown"; cardId: string };

export type DeckAnalysis = {
  legends: DeckLine[];
  main: DeckLine[];
  legendCount: number;
  mainCount: number;
  /** Plafond de RAM par couleur, somme des RAM des Legends de cette couleur. */
  ramLimits: Record<string, number>;
  issues: DeckIssue[];
  valid: boolean;
  /** Nombre de cartes (hors Legends) par coût : index 0 à 6, le dernier regroupe 7+. */
  curve: number[];
  colorCounts: Record<string, number>;
  typeCounts: Record<string, number>;
};

export function isDeckCard(card: Pick<CardDTO, "cardType">) {
  return Boolean(card.cardType) && !NON_DECK_TYPES.has(card.cardType!);
}

export function isLegend(card: Pick<CardDTO, "cardType">) {
  return card.cardType === "Legend";
}

export function isLegal(card: Pick<CardDTO, "legality">) {
  return card.legality !== "not-legal";
}

export function cardLabel(card: Pick<CardDTO, "name" | "subname">) {
  return card.subname ? `${card.name}: ${card.subname}` : card.name;
}

/** Copies autorisées d'une carte : 1 pour une Legend, 3 sinon. */
export function maxCopies(card: Pick<CardDTO, "cardType">) {
  return isLegend(card) ? 1 : DECK_RULES.maxCopies;
}

export function ramLimits(legends: DeckLine[]) {
  const limits: Record<string, number> = {};
  for (const { card, quantity } of legends) {
    if (!card.color || card.ram == null) continue;
    limits[card.color] = (limits[card.color] ?? 0) + card.ram * quantity;
  }
  return limits;
}

/** Une carte respecte la RAM si sa couleur a un plafond suffisant (cartes sans couleur ou sans RAM : toujours). */
export function ramAllowed(card: Pick<CardDTO, "color" | "ram">, limits: Record<string, number>) {
  if (!card.color || card.ram == null) return true;
  return card.ram <= (limits[card.color] ?? 0);
}

const rank = (order: readonly string[], value: string | null) => {
  const index = value ? order.indexOf(value) : -1;
  return index === -1 ? order.length : index;
};

export function compareDeckLines(a: DeckLine, b: DeckLine) {
  return (
    rank(TYPE_ORDER, a.card.cardType) - rank(TYPE_ORDER, b.card.cardType) ||
    (a.card.cost ?? 99) - (b.card.cost ?? 99) ||
    rank(COLOR_ORDER, a.card.color) - rank(COLOR_ORDER, b.card.color) ||
    cardLabel(a.card).localeCompare(cardLabel(b.card), "en")
  );
}

export function analyzeDeck(entries: DeckEntry[], cardsById: Map<string, CardDTO>): DeckAnalysis {
  const issues: DeckIssue[] = [];
  const legends: DeckLine[] = [];
  const main: DeckLine[] = [];
  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const card = cardsById.get(entry.cardId);
    if (!card || !isDeckCard(card)) {
      issues.push({ code: "unknown", cardId: entry.cardId });
      continue;
    }
    (isLegend(card) ? legends : main).push({ card, quantity: entry.quantity });
  }
  legends.sort(compareDeckLines);
  main.sort(compareDeckLines);

  const legendCount = legends.reduce((sum, line) => sum + line.quantity, 0);
  const mainCount = main.reduce((sum, line) => sum + line.quantity, 0);
  if (legendCount !== DECK_RULES.legends) issues.push({ code: "legend-count", count: legendCount });

  // Noms uniques : deux versions d'un même personnage (ou deux copies) sont interdites.
  const legendNames = new Map<string, number>();
  for (const { card, quantity } of legends) legendNames.set(card.name, (legendNames.get(card.name) ?? 0) + quantity);
  for (const [name, count] of legendNames) if (count > 1) issues.push({ code: "legend-name", name });

  if (mainCount < DECK_RULES.minCards || mainCount > DECK_RULES.maxCards) issues.push({ code: "deck-size", count: mainCount });

  const limits = ramLimits(legends);
  for (const { card, quantity } of [...legends, ...main]) {
    const name = cardLabel(card);
    if (!isLegal(card)) issues.push({ code: "not-legal", cardId: card.id, name });
    if (!isLegend(card) && quantity > DECK_RULES.maxCopies) issues.push({ code: "copies", cardId: card.id, name, quantity });
  }
  // Sans Legend, toutes les cartes seraient signalées : on attend la première Legend.
  if (legends.length > 0) {
    for (const { card } of main) {
      if (!ramAllowed(card, limits)) {
        issues.push({ code: "ram", cardId: card.id, name: cardLabel(card), color: card.color!, ram: card.ram!, limit: limits[card.color!] ?? 0 });
      }
    }
  }

  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  const colorCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const { card, quantity } of main) {
    if (card.cost != null) curve[Math.min(Math.max(card.cost, 0), 7)] += quantity;
    if (card.color) colorCounts[card.color] = (colorCounts[card.color] ?? 0) + quantity;
    if (card.cardType) typeCounts[card.cardType] = (typeCounts[card.cardType] ?? 0) + quantity;
  }

  return {
    legends,
    main,
    legendCount,
    mainCount,
    ramLimits: limits,
    issues,
    valid: issues.length === 0,
    curve,
    colorCounts,
    typeCounts,
  };
}

/** Exemplaires possédés par carte de jeu, tous tirages (sets, langues, états) confondus. */
export function ownedCopiesByCard(items: CollectionItemDTO[], printings: PrintingDTO[]) {
  const cardOf = new Map(printings.map((printing) => [printing.id, printing.cardId]));
  const owned = new Map<string, number>();
  for (const item of items) {
    const cardId = cardOf.get(item.printingId);
    if (cardId) owned.set(cardId, (owned.get(cardId) ?? 0) + item.quantity);
  }
  return owned;
}

const toPrice = (value: string | null) => {
  const amount = value == null ? Number.NaN : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

/** Tirage le moins cher d'une carte d'après le prix tendance Cardmarket (null si aucun n'est coté). */
export function cheapestPrinting(printings: PrintingDTO[]) {
  let best: { printing: PrintingDTO; price: number } | null = null;
  for (const printing of printings) {
    const price = toPrice(printing.marketPrice);
    if (price != null && (!best || price < best.price)) best = { printing, price };
  }
  return best;
}

export type ShortfallLine = DeckLine & {
  owned: number;
  missing: number;
  /** Prix unitaire du tirage le moins cher, null si aucun tirage n'est coté. */
  unitPrice: number | null;
  cheapestPrintingId: string | null;
  cost: number | null;
};

export type Shortfall = {
  lines: ShortfallLine[];
  totalCopies: number;
  ownedCopies: number;
  missingCopies: number;
  /** Coût des cartes manquantes cotées. */
  missingCost: number;
  /** Exemplaires manquants sans prix Cardmarket (non inclus dans missingCost). */
  unpricedCopies: number;
  /** Prix du deck complet (tous les exemplaires cotés, possédés ou non). */
  deckCost: number;
  /** Exemplaires du deck sans prix Cardmarket (non inclus dans deckCost). */
  deckUnpricedCopies: number;
};

/**
 * Compare le deck à la collection. Un même exemplaire possédé compte pour chaque deck :
 * c'est « ce qu'il manque pour monter ce deck », pas un partage entre decks.
 */
export function deckShortfall(
  lines: DeckLine[],
  printingsByCard: Map<string, PrintingDTO[]>,
  owned: Map<string, number>,
): Shortfall {
  const result: Shortfall = {
    lines: [],
    totalCopies: 0,
    ownedCopies: 0,
    missingCopies: 0,
    missingCost: 0,
    unpricedCopies: 0,
    deckCost: 0,
    deckUnpricedCopies: 0,
  };
  for (const line of lines) {
    const have = Math.min(owned.get(line.card.id) ?? 0, line.quantity);
    const missing = line.quantity - have;
    const cheapest = cheapestPrinting(printingsByCard.get(line.card.id) ?? []);
    const cost = cheapest && missing > 0 ? cheapest.price * missing : missing > 0 ? null : 0;
    result.lines.push({
      ...line,
      owned: have,
      missing,
      unitPrice: cheapest?.price ?? null,
      cheapestPrintingId: cheapest?.printing.id ?? null,
      cost,
    });
    result.totalCopies += line.quantity;
    result.ownedCopies += have;
    result.missingCopies += missing;
    if (cost != null) result.missingCost += cost;
    else result.unpricedCopies += missing;
    if (cheapest) result.deckCost += cheapest.price * line.quantity;
    else result.deckUnpricedCopies += line.quantity;
  }
  return result;
}

/** Liste texte « 3 Nom: Sous-titre », Legends d'abord (partage, import dans un autre outil). */
export function deckToText(lines: DeckLine[]) {
  return [...lines]
    .sort(compareDeckLines)
    .map((line) => `${line.quantity} ${cardLabel(line.card)}`)
    .join("\n");
}

export type ParsedDeckText = { entries: DeckEntry[]; unmatched: string[] };

/**
 * Lit une liste texte : une carte par ligne, « 3 Nom », « 3x Nom » ou « Nom » (1 exemplaire).
 * Les lignes vides, de commentaire (// ou #) et les en-têtes « Legends: » sont ignorées.
 * Un nom sans sous-titre est accepté s'il ne désigne qu'une seule carte.
 */
export function parseDeckText(text: string, cards: CardDTO[]): ParsedDeckText {
  const byFull = new Map<string, CardDTO>();
  const byBase = new Map<string, CardDTO[]>();
  for (const card of cards) {
    if (!isDeckCard(card)) continue;
    byFull.set(normalizeText(cardLabel(card)), card);
    const base = normalizeText(card.name);
    byBase.set(base, [...(byBase.get(base) ?? []), card]);
  }
  const quantities = new Map<string, number>();
  const unmatched: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#") || /:\s*$/.test(line)) continue;
    const match = line.match(/^(\d{1,2})\s*x?\s+(.+)$/i);
    const quantity = match ? Number(match[1]) : 1;
    // La ponctuation est ignorée : « V: Streetkid » et « V — Streetkid » se valent.
    const name = normalizeText(match ? match[2] : line);
    const card = byFull.get(name) ?? (byBase.get(name)?.length === 1 ? byBase.get(name)![0] : undefined);
    if (!card || quantity <= 0) {
      unmatched.push(line);
      continue;
    }
    // 9 = maximum accepté par l'API ; au-delà de 3, la validation signale déjà l'excès.
    quantities.set(card.id, Math.min((quantities.get(card.id) ?? 0) + quantity, 9));
  }
  return { entries: [...quantities].map(([cardId, quantity]) => ({ cardId, quantity })), unmatched };
}
