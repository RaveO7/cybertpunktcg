// Decks enregistrés par compte. La validité (Legends, taille, RAM…) est calculée à l'affichage
// (src/lib/deck-rules.ts) : un deck en cours de construction peut être incomplet.
import { isDeckCard } from "./deck-rules";
import { prisma } from "./prisma";
import type { DeckDTO } from "./types";

/** Nombre maximum de decks par compte. */
export const MAX_DECKS = 100;

const DEFAULT_NAME = "Nouveau deck";

type CardInput = { cardId: string; quantity: number };
type CreateInput = { name?: string; cards?: CardInput[] };
type PatchInput = { name?: string; notes?: string | null; cards?: CardInput[] };

const include = { cards: { select: { cardId: true, quantity: true } } } as const;

type Row = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  cards: CardInput[];
};

function toDTO(row: Row): DeckDTO {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    cards: row.cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Regroupe les doublons et vérifie que chaque carte existe et est jouable (pas un produit scellé). */
async function resolveCards(cards: CardInput[]) {
  const quantities = new Map<string, number>();
  for (const { cardId, quantity } of cards) quantities.set(cardId, Math.min((quantities.get(cardId) ?? 0) + quantity, 9));
  if (quantities.size === 0) return [];
  const known = await prisma.card.findMany({
    where: { id: { in: [...quantities.keys()] }, isActive: true },
    select: { id: true, cardType: true },
  });
  const playable = new Set(known.filter(isDeckCard).map((card) => card.id));
  if (playable.size !== quantities.size) throw new Error("Carte introuvable.");
  return [...quantities].map(([cardId, quantity]) => ({ cardId, quantity }));
}

export async function loadDecks(userId: string) {
  const rows = await prisma.deck.findMany({ where: { userId }, include, orderBy: { updatedAt: "desc" } });
  return rows.map(toDTO);
}

export async function createDeck(userId: string, input: CreateInput) {
  if ((await prisma.deck.count({ where: { userId } })) >= MAX_DECKS) {
    throw new Error(`Nombre maximum de decks atteint (${MAX_DECKS}).`);
  }
  const cards = await resolveCards(input.cards ?? []);
  const row = await prisma.deck.create({
    data: { userId, name: input.name ?? DEFAULT_NAME, cards: { create: cards } },
    include,
  });
  return toDTO(row);
}

/** Renomme le deck et/ou remplace sa liste de cartes. */
export async function updateDeck(userId: string, id: string, input: PatchInput) {
  const existing = await prisma.deck.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new Error("Deck introuvable.");
  const data: { name?: string; notes?: string | null; updatedAt: Date } = { updatedAt: new Date() };
  if (input.name !== undefined) data.name = input.name;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.cards === undefined) return toDTO(await prisma.deck.update({ where: { id }, data, include }));
  const cards = await resolveCards(input.cards);
  const [, , row] = await prisma.$transaction([
    prisma.deckCard.deleteMany({ where: { deckId: id } }),
    prisma.deckCard.createMany({ data: cards.map((card) => ({ deckId: id, ...card })) }),
    prisma.deck.update({ where: { id }, data, include }),
  ]);
  return toDTO(row);
}

export async function deleteDeck(userId: string, id: string) {
  const result = await prisma.deck.deleteMany({ where: { id, userId } });
  return { deletedId: result.count > 0 ? id : null };
}
