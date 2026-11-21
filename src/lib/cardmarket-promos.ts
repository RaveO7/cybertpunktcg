// Promos vendues sur Cardmarket mais absentes du catalogue netdeck (ex. « Jackie & V — Chooms to the End ») :
// l'import des prix les ajoute à l'extension promo reliée (EXPANSION_SET_BY_ID), même sans prix, pour que
// chaque nouvelle promo apparaisse d'elle-même. Elles portent l'externalId `cardmarket:<idProduct>` et prennent
// le prix de leur produit, comme les produits scellés.
import type { PrismaClient } from "@prisma/client";
import { EXPANSION_SET_BY_ID, expansionKey, productNameKey, type CardmarketProduct } from "./cardmarket";
import { sealedExternalId, slugifySealed } from "./cardmarket-sealed";

export type PromoPlan = {
  /** Produits sans carte du catalogue : à créer (ou réactiver). */
  missing: { product: CardmarketProduct; setCode: string }[];
  /** Produits désormais présents dans netdeck : leur copie Cardmarket est désactivée. */
  covered: number[];
};

/** `catalogNames` : clés de nom (productNameKey) des impressions netdeck actives, par code d'extension. */
export function planPromoProducts(products: CardmarketProduct[], catalogNames: Map<string, Set<string>>): PromoPlan {
  const plan: PromoPlan = { missing: [], covered: [] };
  for (const product of products) {
    const setCode = EXPANSION_SET_BY_ID[expansionKey(product)];
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
  const setCodes = [...new Set(Object.values(EXPANSION_SET_BY_ID))];
  const [sets, printings] = await Promise.all([
    prisma.set.findMany({ where: { code: { in: setCodes } }, select: { id: true, code: true } }),
    prisma.printing.findMany({
      where: { isActive: true, set: { code: { in: setCodes } }, NOT: { externalId: { startsWith: "cardmarket:" } } },
      select: { set: { select: { code: true } }, card: { select: { canonicalName: true } } },
    }),
  ]);
  const catalogNames = new Map<string, Set<string>>(sets.map((set) => [set.code, new Set<string>()]));
  for (const printing of printings) catalogNames.get(printing.set.code)?.add(productNameKey(printing.card.canonicalName));
  const setIdByCode = new Map(sets.map((set) => [set.code, set.id]));
  const plan = planPromoProducts(products, catalogNames);

  for (const { product, setCode } of plan.missing) {
    const setId = setIdByCode.get(setCode);
    if (!setId) continue;
    const externalId = sealedExternalId(product.idProduct);
    const { name, subname } = splitPromoName(product.name);
    const displayName = subname ? `${name}: ${subname}` : name;
    const canonicalName = subname ? `${name} — ${subname}` : name;
    const fields = { name, subname, displayName, canonicalName, canonicalBaseName: name, isActive: true };
    const card = await prisma.card.upsert({
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
    await prisma.printing.upsert({
      where: { externalId },
      update: { cardId: card.id, setId, isActive: true },
      create: { externalId, cardId: card.id, setId, collectorNumber: String(product.idProduct), language: "en" },
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
