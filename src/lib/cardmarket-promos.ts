// Cartes vendues sur Cardmarket mais absentes de netdeck : promos d'une extension reliée (EXPANSION_SET_BY_ID,
// ex. « Jackie & V — Chooms to the End ») et extensions entières inconnues de netdeck (CARDMARKET_ONLY_SETS,
// ex. l'Alpha Kit). L'import des prix les ajoute, même sans prix, pour que chaque nouvelle carte apparaisse
// d'elle-même. Leurs impressions portent l'externalId `cardmarket:<idProduct>` et prennent le prix de leur
// produit, comme les produits scellés. Une carte déjà connue sous le même nom reçoit l'impression ; sinon une
// carte est créée.
import type { PrismaClient } from "@prisma/client";
import { EXPANSION_SET_BY_ID, expansionKey, productNameKey, type CardmarketProduct } from "./cardmarket";
import { sealedExternalId, slugifySealed } from "./cardmarket-sealed";
import { ALPHA_KIT_DETAILS } from "./alpha-kit-data";

/** Extensions Cardmarket sans équivalent netdeck : l'extension du catalogue est créée par l'import. */
export const CARDMARKET_ONLY_SETS: Readonly<Record<string, { code: string; name: string; sortOrder: number }>> = {
  // « Alpha » (Alpha Kit, A001–A031) : kit d'accès anticipé, cartes reprises dans les starter decks.
  "id:6722": { code: "alphakit", name: "Alpha", sortOrder: 100 },
};

/** Fiche d'un produit relevée ailleurs que sur Cardmarket (numéro, visuel, texte et caractéristiques imprimés). */
export type PromoDetails = {
  collectorNumber: string;
  imagePath: string;
  sourceImageUrl: string;
  rulesText: string | null;
  card: { cardType: string; color: string | null; cost: number | null; power: number | null; ram: number | null };
};

export type PromoPlan = {
  /** Produits sans carte netdeck dans leur extension : à créer (ou réactiver). */
  missing: { product: CardmarketProduct; setCode: string }[];
  /** Produits désormais présents dans netdeck : leur copie Cardmarket est désactivée. */
  covered: number[];
};

function targetSetCode(product: CardmarketProduct) {
  const key = expansionKey(product);
  return EXPANSION_SET_BY_ID[key] ?? CARDMARKET_ONLY_SETS[key]?.code;
}

/** `catalogNames` : clés de nom (productNameKey) des impressions netdeck actives, par code d'extension. */
export function planPromoProducts(products: CardmarketProduct[], catalogNames: Map<string, Set<string>>): PromoPlan {
  const plan: PromoPlan = { missing: [], covered: [] };
  for (const product of products) {
    const setCode = targetSetCode(product);
    const names = setCode ? catalogNames.get(setCode) : undefined;
    if (!setCode || !names) continue;
    if (names.has(productNameKey(product.name))) plan.covered.push(product.idProduct);
    else plan.missing.push({ product, setCode });
  }
  return plan;
}

/** « Jackie & V — Chooms to the End » → nom « Jackie & V », sous-titre « Chooms to the End ». */
export function splitPromoName(name: string) {
  const match = /^(.+?)\s+[—–-]\s+(.+)$/.exec(name.trim());
  if (!match) return { name: name.trim(), subname: null };
  return { name: match[1], subname: match[2] };
}

export async function upsertPromoProducts(prisma: PrismaClient, products: CardmarketProduct[]) {
  for (const set of Object.values(CARDMARKET_ONLY_SETS)) {
    await prisma.set.upsert({
      where: { code: set.code },
      update: { name: set.name, sortOrder: set.sortOrder, status: "available" },
      create: { ...set, status: "available", cardCount: 0 },
    });
  }
  const setCodes = [
    ...new Set([...Object.values(EXPANSION_SET_BY_ID), ...Object.values(CARDMARKET_ONLY_SETS).map((set) => set.code)]),
  ];
  const [sets, printings, catalogCards] = await Promise.all([
    prisma.set.findMany({ where: { code: { in: setCodes } }, select: { id: true, code: true } }),
    prisma.printing.findMany({
      where: { isActive: true, set: { code: { in: setCodes } }, NOT: { externalId: { startsWith: "cardmarket:" } } },
      select: { set: { select: { code: true } }, card: { select: { canonicalName: true } } },
    }),
    prisma.card.findMany({
      where: { isActive: true, NOT: { externalId: { startsWith: "cardmarket:" } } },
      select: { id: true, canonicalName: true },
    }),
  ]);
  const catalogNames = new Map<string, Set<string>>(sets.map((set) => [set.code, new Set<string>()]));
  for (const printing of printings) catalogNames.get(printing.set.code)?.add(productNameKey(printing.card.canonicalName));
  const cardIdByName = new Map(catalogCards.map((card) => [productNameKey(card.canonicalName), card.id]));
  const setIdByCode = new Map(sets.map((set) => [set.code, set.id]));
  const plan = planPromoProducts(products, catalogNames);

  for (const { product, setCode } of plan.missing) {
    const setId = setIdByCode.get(setCode);
    if (!setId) continue;
    const externalId = sealedExternalId(product.idProduct);
    const details = ALPHA_KIT_DETAILS[product.idProduct];
    const cardId =
      cardIdByName.get(productNameKey(product.name)) ?? (await upsertPromoCard(prisma, product, details)).id;
    const printed = {
      collectorNumber: details?.collectorNumber ?? String(product.idProduct),
      imagePath: details?.imagePath ?? null,
      sourceImageUrl: details?.sourceImageUrl ?? null,
      printedRulesText: details?.rulesText ?? null,
      rarity: details ? "Promo" : null,
    };
    await prisma.printing.upsert({
      where: { externalId },
      update: { ...printed, cardId, setId, isActive: true },
      create: { ...printed, externalId, cardId, setId, language: "en" },
    });
  }
  const coveredIds = plan.covered.map((id) => sealedExternalId(id));
  const retired = await prisma.printing.updateMany({
    where: { externalId: { in: coveredIds }, isActive: true },
    data: { isActive: false },
  });
  await prisma.card.updateMany({ where: { externalId: { in: coveredIds }, isActive: true }, data: { isActive: false } });
  for (const set of sets) {
    const cardCount = await prisma.printing.count({ where: { setId: set.id, isActive: true } });
    await prisma.set.update({ where: { id: set.id }, data: { cardCount } });
  }
  return { added: plan.missing.length, retired: retired.count };
}

/** Carte inconnue du catalogue : créée d'après le nom du produit et, s'il y en a une, sa fiche relevée ailleurs. */
function upsertPromoCard(prisma: PrismaClient, product: CardmarketProduct, details: PromoDetails | undefined) {
  const externalId = sealedExternalId(product.idProduct);
  const { name, subname } = splitPromoName(product.name);
  const fields = {
    name,
    subname,
    displayName: subname ? `${name}: ${subname}` : name,
    canonicalName: subname ? `${name} — ${subname}` : name,
    canonicalBaseName: name,
    ...details?.card,
    rulesText: details?.rulesText ?? null,
    isActive: true,
  };
  return prisma.card.upsert({
    where: { externalId },
    update: fields,
    create: {
      ...fields,
      externalId,
      code: externalId,
      slug: slugifySealed(product.name, product.idProduct),
      language: "en",
    },
    select: { id: true },
  });
}
