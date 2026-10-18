import { prisma } from "@/lib/prisma";
import { BETA_SET_CODE, SEALED_SET_PREFIX } from "@/lib/reference-data";
import { expect, expectNoHorizontalScroll, snap, test } from "./fixtures";

test("une carte de la collection apparaît sur le tableau de bord", async ({ page, account }) => {
  // Catalogue local en lecture seule : une impression anglaise existante (langue par défaut du tableau).
  const printing =
    (await prisma.printing.findFirst({ where: { language: "en", set: { code: BETA_SET_CODE } } })) ??
    (await prisma.printing.findFirst({ where: { language: "en", set: { code: { not: { startsWith: SEALED_SET_PREFIX } } } } }));
  const condition = await prisma.condition.findFirst({ where: { code: "NM" } });
  test.skip(!printing || !condition, "Catalogue local vide : lancer `npm run import:cards` pour ce test.");

  // Ligne du compte de test : supprimée avec lui.
  await prisma.collectionItem.create({
    data: { userId: account.id, printingId: printing!.id, conditionId: condition!.id, quantity: 1 },
  });

  await page.goto("/fr");
  const uniques = page
    .getByText("Cartes uniques", { exact: true })
    .locator("xpath=ancestor::*[contains(@class, 'flex-col')][1]");
  await expect(uniques.locator(".text-yellow")).toHaveText("1");
  await expectNoHorizontalScroll(page);
  await snap(page, "collection-tableau-de-bord");
});
