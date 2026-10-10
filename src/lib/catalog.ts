import { unstable_cache } from "next/cache";
import { userFromRequest } from "./auth";
import { prisma } from "./prisma";
import type { CardDTO, CatalogDTO, CollectionItemDTO, ConditionDTO, PrintingDTO, SetDTO } from "./types";

export const CATALOG_CACHE_TAG = "catalog";

function decimalToString(value: { toString(): string } | null) {
  return value == null ? null : value.toString();
}

export async function loadCatalog(): Promise<CatalogDTO> {
  const [sets, conditions, cards, printings, prices] = await Promise.all([
    prisma.set.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.condition.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.card.findMany({
      where: { isActive: true },
      include: { tags: true, keywords: true },
    }),
    prisma.printing.findMany({
      where: { isActive: true },
      include: { set: true },
    }),
    prisma.price.findMany({
      where: { kind: "trend", source: { code: "cardmarket" } },
      select: { printingId: true, amount: true, previousAmount: true },
    }),
  ]);
  const marketPriceByPrinting = new Map(prices.map((price) => [price.printingId, decimalToString(price.amount)]));
  const previousMarketPriceByPrinting = new Map(
    prices.map((price) => [price.printingId, decimalToString(price.previousAmount)]),
  );

  const cardDTOs: CardDTO[] = cards.map((card) => ({
    id: card.id,
    externalId: card.externalId,
    slug: card.slug,
    name: card.name,
    subname: card.subname,
    canonicalName: card.canonicalName,
    rulesText: card.rulesText,
    flavorText: card.flavorText,
    color: card.color,
    cardType: card.cardType,
    isEddiable: card.isEddiable,
    cost: card.cost,
    power: card.power,
    ram: card.ram,
    legality: card.legality,
    tags: card.tags.map((tag) => tag.tag).sort(),
    keywords: card.keywords.map((keyword) => keyword.keyword).sort(),
  }));

  const printingDTOs: PrintingDTO[] = printings.map((printing) => ({
    id: printing.id,
    cardId: printing.cardId,
    externalId: printing.externalId,
    setCode: printing.set.code,
    setName: printing.set.name,
    collectorNumber: printing.collectorNumber,
    rarity: printing.rarity,
    language: printing.language,
    localizedName: printing.localizedName,
    imagePath: printing.imagePath,
    artist: printing.artist,
    printedRulesText: printing.printedRulesText,
    officialFinish: printing.officialFinish,
    marketPrice: marketPriceByPrinting.get(printing.id) ?? null,
    previousMarketPrice: previousMarketPriceByPrinting.get(printing.id) ?? null,
  }));

  const setDTOs: SetDTO[] = sets.map((set) => ({
    code: set.code,
    name: set.name,
    number: set.number,
    releaseDate: set.releaseDate ? set.releaseDate.toISOString() : null,
    logoUrl: set.logoUrl,
    description: set.description,
    cardCount: set.cardCount,
    status: set.status,
    sortOrder: set.sortOrder,
  }));

  const conditionDTOs: ConditionDTO[] = conditions.map((condition) => ({
    code: condition.code,
    name: condition.name,
    sortOrder: condition.sortOrder,
  }));

  return {
    sets: setDTOs,
    conditions: conditionDTOs,
    cards: cardDTOs,
    printings: printingDTOs,
    hasPrices: prices.length > 0,
  };
}

/// Catalogue identique pour tous : mis en cache par Next (partagé entre instances sur Vercel).
/// Les prix sont importés une fois par jour, une heure de retard maximum est acceptable.
export const loadCatalogCached = unstable_cache(loadCatalog, ["catalog"], {
  tags: [CATALOG_CACHE_TAG],
  revalidate: 3600,
});

export async function loadCollection(userId: string): Promise<CollectionItemDTO[]> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { condition: true },
    orderBy: { addedAt: "asc" },
  });
  return items.map((item) => ({
    id: item.id,
    printingId: item.printingId,
    conditionCode: item.condition.code,
    conditionName: item.condition.name,
    quantity: item.quantity,
    notes: item.notes,
    purchasePrice: decimalToString(item.purchasePrice),
    purchaseCurrency: item.purchaseCurrency,
    addedAt: item.addedAt.toISOString(),
  }));
}

export async function requireUser(request: Request) {
  return userFromRequest(request);
}
