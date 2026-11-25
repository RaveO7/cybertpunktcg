import {
  sealedCategoryFor,
  SEALED_LANGUAGES,
  sealedExternalId,
  sealedProductId,
  slugifySealed,
  type SealedProduct,
} from "../cardmarket-sealed";
import type { Ctx } from "./types";

export async function upsertSealedProducts({ prisma }: Ctx, products: SealedProduct[]) {
  const categories = new Map<string, ReturnType<typeof sealedCategoryFor>>();
  for (const product of products) {
    const category = sealedCategoryFor(product);
    categories.set(category.code, category);
  }
  for (const category of categories.values()) {
    await prisma.set.upsert({
      where: { code: category.code },
      update: { name: category.name, sortOrder: category.sortOrder, status: "available" },
      create: {
        code: category.code,
        name: category.name,
        sortOrder: category.sortOrder,
        status: "available",
        cardCount: 0,
      },
    });
  }
  const sets = await prisma.set.findMany({
    where: { code: { in: [...categories.keys()] } },
    select: { id: true, code: true },
  });
  const setIdByCode = new Map(sets.map((set) => [set.code, set.id]));
  let count = 0;
  for (const product of products) {
    const category = sealedCategoryFor(product);
    const setId = setIdByCode.get(category.code);
    if (!setId) continue;
    const externalId = sealedExternalId(product.idProduct);
    const slug = slugifySealed(product.name, product.idProduct);
    const card = await prisma.card.upsert({
      where: { externalId },
      update: {
        name: product.name,
        displayName: product.name,
        canonicalName: product.name,
        cardType: category.cardType,
        isActive: true,
      },
      create: {
        externalId,
        code: externalId,
        slug,
        name: product.name,
        displayName: product.name,
        canonicalName: product.name,
        cardType: category.cardType,
        language: "en",
      },
    });
    // Une impression par langue : même produit, même prix tendance, même visuel.
    type SealedImage = { imagePath: string | null; sourceImageUrl: string | null };
    let image: SealedImage | null = null;
    for (const language of SEALED_LANGUAGES) {
      const printingExternalId = sealedExternalId(product.idProduct, language);
      const printing: SealedImage & { id: string } = await prisma.printing.upsert({
        where: { externalId: printingExternalId },
        update: {
          cardId: card.id,
          setId,
          collectorNumber: String(product.idProduct),
          rarity: category.cardType,
          language,
          localizedName: product.name,
          isActive: true,
        },
        create: {
          externalId: printingExternalId,
          cardId: card.id,
          setId,
          collectorNumber: String(product.idProduct),
          rarity: category.cardType,
          language,
          localizedName: product.name,
          imagePath: image?.imagePath ?? null,
          sourceImageUrl: image?.sourceImageUrl ?? null,
        },
        select: { id: true, imagePath: true, sourceImageUrl: true },
      });
      if (!image && printing.imagePath) {
        image = printing;
      } else if (image && !printing.imagePath) {
        await prisma.printing.update({
          where: { id: printing.id },
          data: { imagePath: image.imagePath, sourceImageUrl: image.sourceImageUrl },
        });
      }
    }
    count += 1;
  }
  for (const category of categories.values()) {
    const setId = setIdByCode.get(category.code);
    if (!setId) continue;
    const cardCount = await prisma.printing.count({ where: { setId, isActive: true, language: "en" } });
    await prisma.set.update({ where: { id: setId }, data: { cardCount } });
  }
  return { products: count };
}

export async function sealedPriceAssignments({ prisma }: Ctx, trends: Map<number, number>) {
  const printings = await prisma.printing.findMany({
    where: { isActive: true, externalId: { startsWith: "cardmarket:" } },
    select: { id: true, externalId: true },
  });
  const assignments: { printingId: string; amount: string; productId: number }[] = [];
  for (const printing of printings) {
    const idProduct = sealedProductId(printing.externalId);
    if (idProduct == null) continue;
    const amount = trends.get(idProduct);
    if (amount == null) continue;
    assignments.push({ printingId: printing.id, amount: amount.toFixed(2), productId: idProduct });
  }
  return assignments;
}
