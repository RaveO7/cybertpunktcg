// Partage d'un deck en lecture seule par un lien à jeton (même principe que le classeur partagé,
// src/lib/share.ts). Un lien au plus par deck, supprimé avec le deck.
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { formatRoute } from "@/i18n/match";
import { requestLocale } from "@/lib/api-response";
import { absoluteAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { createShareToken, isShareTokenFormat } from "@/lib/share-token";
import { analyzeDeck, deckShortfall, deckToText, type DeckAnalysis, type DeckEntry, type DeckLine } from "@/lib/deck-rules";
import { TYPE_ORDER } from "@/lib/reference-data";
import type { CardDTO, CatalogDTO, PrintingDTO } from "@/lib/types";

export type DeckShareInfo = { active: false } | { active: true; token: string; path: string; url: string; createdAt: string };

/** Adresse du deck partagé, dans la langue de celui qui partage. */
export function deckSharePath(token: string, locale: Locale = DEFAULT_LOCALE) {
  return formatRoute("/deck/[token]", locale, { token });
}

export function deckShareInfo(request: Request, share: { token: string; createdAt: Date } | null): DeckShareInfo {
  if (!share) return { active: false };
  const path = deckSharePath(share.token, requestLocale(request));
  return { active: true, token: share.token, path, url: absoluteAppUrl(request, path), createdAt: share.createdAt.toISOString() };
}

/** Le deck appartient-il à ce compte ? (sinon on répond comme s'il n'existait pas). */
export async function ownsDeck(userId: string, deckId: string) {
  return (await prisma.deck.count({ where: { id: deckId, userId } })) > 0;
}

export async function getDeckShare(deckId: string) {
  return prisma.deckShare.findUnique({ where: { deckId } });
}

/** Renvoie le lien existant, ou en crée un ; `rotate` remplace le jeton (l'ancien cesse de fonctionner). */
export async function createOrRotateDeckShare(deckId: string, rotate = false) {
  if (!rotate) {
    const existing = await getDeckShare(deckId);
    if (existing) return existing;
  }
  const token = createShareToken();
  return prisma.deckShare.upsert({
    where: { deckId },
    create: { deckId, token },
    update: { token, createdAt: new Date() },
  });
}

export async function revokeDeckShare(deckId: string) {
  await prisma.deckShare.deleteMany({ where: { deckId } });
}

export type SharedDeck = {
  name: string;
  owner: { displayName: string };
  cards: DeckEntry[];
  updatedAt: string;
};

/**
 * Deck d'un lien actif, réduit à ce qui est public : nom, nom d'affichage du propriétaire et cartes.
 * Ni e-mail, ni notes, ni identifiants de compte ou de deck.
 */
export async function loadSharedDeck(token: string): Promise<SharedDeck | null> {
  if (!isShareTokenFormat(token)) return null;
  const share = await prisma.deckShare.findUnique({
    where: { token },
    select: {
      deck: {
        select: {
          name: true,
          updatedAt: true,
          user: { select: { displayName: true } },
          cards: { select: { cardId: true, quantity: true } },
        },
      },
    },
  });
  if (!share) return null;
  const { deck } = share;
  return {
    name: deck.name,
    owner: { displayName: deck.user.displayName },
    cards: deck.cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
    updatedAt: deck.updatedAt.toISOString(),
  };
}

export type SharedDeckGroup = { key: string; lines: DeckLine[] };

export type SharedDeckSummary = {
  analysis: DeckAnalysis;
  /** Cartes hors Legends, groupées par type dans l'ordre de TYPE_ORDER ; « other » en dernier. */
  groups: SharedDeckGroup[];
  totalCards: number;
  /** Prix indicatif du deck complet (tirage le moins cher de chaque carte), hors cartes non cotées. */
  deckCost: number;
  unpricedCopies: number;
  /** Liste texte, au format de l'export des decks. */
  text: string;
};

/** Analyse, groupes, total et prix d'un deck partagé, à partir du catalogue (calcul côté serveur). */
export function summarizeSharedDeck(cards: DeckEntry[], catalog: Pick<CatalogDTO, "cards" | "printings">): SharedDeckSummary {
  const wanted = new Set(cards.map((entry) => entry.cardId));
  const cardsById = new Map<string, CardDTO>();
  for (const card of catalog.cards) if (wanted.has(card.id)) cardsById.set(card.id, card);
  const printingsByCard = new Map<string, PrintingDTO[]>();
  for (const printing of catalog.printings) {
    if (wanted.has(printing.cardId)) printingsByCard.set(printing.cardId, [...(printingsByCard.get(printing.cardId) ?? []), printing]);
  }
  const analysis = analyzeDeck(cards, cardsById);
  const known = TYPE_ORDER as readonly string[];
  const groups = [
    ...TYPE_ORDER.filter((type) => type !== "Legend").map((type) => ({
      key: type as string,
      lines: analysis.main.filter((line) => line.card.cardType === type),
    })),
    { key: "other", lines: analysis.main.filter((line) => !known.includes(line.card.cardType ?? "")) },
  ].filter((group) => group.lines.length > 0);
  const lines = [...analysis.legends, ...analysis.main];
  const cost = deckShortfall(lines, printingsByCard, new Map());
  return {
    analysis,
    groups,
    totalCards: analysis.legendCount + analysis.mainCount,
    deckCost: cost.deckCost,
    unpricedCopies: cost.deckUnpricedCopies,
    text: deckToText(lines),
  };
}

/** Image de chaque Legend : un tirage anglais avec image de préférence (comme l'éditeur de decks). */
export function legendImages(legends: DeckLine[], printings: PrintingDTO[]) {
  const wanted = new Set(legends.map((line) => line.card.id));
  const best = new Map<string, PrintingDTO>();
  for (const printing of printings) {
    if (!wanted.has(printing.cardId) || !printing.imagePath) continue;
    const current = best.get(printing.cardId);
    if (!current || (current.language !== "en" && printing.language === "en")) best.set(printing.cardId, printing);
  }
  return Object.fromEntries([...best].map(([cardId, printing]) => [cardId, printing.imagePath!]));
}
