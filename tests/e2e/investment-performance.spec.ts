import { prisma } from "@/lib/prisma";
import { expect, settle, test } from "./fixtures";

/**
 * Page Investissement, rendu allégé : une seule mise en page (liste ou tableau, l'autre n'est pas rendue)
 * et un détail affiché par paquets de 100 cartes. Les exemplaires créés appartiennent au compte du test,
 * supprimé à la fin.
 */

test("une seule mise en page, détail affiché par paquets", async ({ page, account, isMobile }) => {
  const printings = await prisma.printing.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 130 });
  test.skip(printings.length < 130, "Pas assez de cartes dans le catalogue local.");
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  await prisma.collectionItem.createMany({
    data: printings.map((printing) => ({ userId: account.id, printingId: printing.id, conditionId: condition.id, quantity: 1 })),
  });

  await page.goto("/fr/investissement");
  await settle(page);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
  const detail = page.locator("section").filter({ has: page.getByRole("heading", { name: "Détail des cartes" }) });
  const bySet = page.locator("section").filter({ has: page.getByRole("heading", { name: "Par extension" }) });
  // L'autre mise en page n'existe pas dans la page (pas seulement masquée en CSS).
  await expect(detail.locator(isMobile ? "table" : "ul")).toHaveCount(0);
  await expect(bySet.locator(isMobile ? "table" : "ul")).toHaveCount(0);

  const rows = detail.locator(isMobile ? "ul > li" : "tbody > tr");
  await expect(rows).toHaveCount(100);
  const more = detail.getByRole("button", { name: "Afficher plus · 30 cartes restantes" });
  await expect(more).toBeAttached();
  // À l'approche du bas de la liste, la suite arrive d'elle-même.
  await more.scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(130);
  await expect(more).toHaveCount(0);
});
