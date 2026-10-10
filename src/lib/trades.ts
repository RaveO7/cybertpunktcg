// Exemplaires en trop : ce qui dépasse la limite par deck (3 copies, 1 pour une Legend), tous tirages
// (sets, langues, états) confondus. Ce sont les cartes à échanger. Module pur : tableau de bord,
// classeur partagé, filtre « En trop » de l'explorateur et tests.
import { cheapestPrinting, compareDeckLines, isDeckCard, maxCopies } from "./deck-rules";
import type { CardDTO, Ownership, PrintingDTO } from "./types";

export type TradePrinting = { printing: PrintingDTO; quantity: number };

export type TradeLine = {
  card: CardDTO;
  /** Exemplaires possédés, tous tirages confondus. */
  owned: number;
  /** Exemplaires autorisés dans un deck. */
  limit: number;
  extra: number;
  /** Tirages possédés, du plus au moins possédé. */
  printings: TradePrinting[];
  /** Prix du tirage possédé le moins cher : on garde les plus chers, on échange le reste. */
  unitPrice: number | null;
  value: number | null;
};

export type TradeList = {
  lines: TradeLine[];
  extraCopies: number;
  /** Valeur des exemplaires en trop cotés. */
  value: number;
  /** Exemplaires en trop sans prix Cardmarket (non inclus dans value). */
  unpricedCopies: number;
};

function ownedByCard(printings: PrintingDTO[], agg: Map<string, Ownership>) {
  const byCard = new Map<string, TradePrinting[]>();
  for (const printing of printings) {
    const quantity = agg.get(printing.id)?.qty ?? 0;
    if (quantity <= 0) continue;
    byCard.set(printing.cardId, [...(byCard.get(printing.cardId) ?? []), { printing, quantity }]);
  }
  return byCard;
}

const total = (list: TradePrinting[]) => list.reduce((sum, entry) => sum + entry.quantity, 0);

/** Cartes de jeu dont la collection dépasse la limite par deck (pour le filtre « En trop »). */
export function cardsWithExtras(printings: PrintingDTO[], cards: Map<string, CardDTO>, agg: Map<string, Ownership>) {
  const result = new Set<string>();
  for (const [cardId, owned] of ownedByCard(printings, agg)) {
    const card = cards.get(cardId);
    if (card && isDeckCard(card) && total(owned) > maxCopies(card)) result.add(cardId);
  }
  return result;
}

/** Liste des cartes à échanger, de la plus grosse quantité en trop à la plus petite. */
export function tradeList(printings: PrintingDTO[], cards: Map<string, CardDTO>, agg: Map<string, Ownership>): TradeList {
  const result: TradeList = { lines: [], extraCopies: 0, value: 0, unpricedCopies: 0 };
  for (const [cardId, owned] of ownedByCard(printings, agg)) {
    const card = cards.get(cardId);
    if (!card || !isDeckCard(card)) continue;
    const count = total(owned);
    const limit = maxCopies(card);
    const extra = count - limit;
    if (extra <= 0) continue;
    const unitPrice = cheapestPrinting(owned.map((entry) => entry.printing))?.price ?? null;
    const value = unitPrice == null ? null : unitPrice * extra;
    result.lines.push({
      card,
      owned: count,
      limit,
      extra,
      printings: [...owned].sort((a, b) => b.quantity - a.quantity),
      unitPrice,
      value,
    });
    result.extraCopies += extra;
    if (value == null) result.unpricedCopies += extra;
    else result.value += value;
  }
  result.lines.sort((a, b) => b.extra - a.extra || compareDeckLines({ card: a.card, quantity: 0 }, { card: b.card, quantity: 0 }));
  return result;
}
