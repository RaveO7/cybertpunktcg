import type { Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

/**
 * Page Investissement : vue gardée dans l'URL, tri par défaut signalé, sélection (cases sur téléphone)
 * et collection vide. Les exemplaires créés appartiennent au compte du test, supprimé à la fin.
 */

async function ready(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
}

/** Deux impressions qui ont un prix et un historique dans le catalogue local (lecture seule). */
async function pricedPrintings() {
  const snapshots = await prisma.priceSnapshot
    .findMany({ distinct: ["printingId"], select: { printingId: true }, take: 2, orderBy: { printingId: "asc" } })
    .catch(() => []);
  return snapshots.map((snapshot) => snapshot.printingId);
}

test("collection vide : invitation à ajouter des cartes", async ({ page, account }) => {
  void account;
  await ready(page, "/fr/investissement");
  await expect(page.getByRole("heading", { name: "Aucune carte dans votre collection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajouter des cartes" })).toHaveAttribute("href", /\/cards/);
  await expect(page.getByText("npm run")).toHaveCount(0);
});

test("vue dans l'URL, tri par défaut et sélection", async ({ page, account, isMobile }) => {
  const printingIds = await pricedPrintings();
  test.skip(printingIds.length < 2, "Pas assez d'historique de prix local.");
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  for (const printingId of printingIds) {
    await prisma.collectionItem.create({
      data: { userId: account.id, printingId, conditionId: condition.id, quantity: 1, purchasePrice: 0.05, purchaseCurrency: "EUR" },
    });
  }

  // Durée en tête de page, gardée dans l'URL et au rechargement.
  await ready(page, "/fr/investissement");
  const range = page.getByRole("group", { name: "Durée" });
  await range.getByRole("button", { name: "1 mois", exact: true }).click();
  await expect(page).toHaveURL(/[?&]range=1m/);
  await expect(page.getByText("Variation sur 1 mois")).toBeVisible();
  await snap(page, "investissement-entete");
  const search = page.locator('input[aria-label="Recherche"]:visible');
  if (!isMobile) await page.getByRole("combobox", { name: "Performance" }).selectOption("profit");
  await page.reload();
  await settle(page);
  await expect(range.getByRole("button", { name: "1 mois", exact: true })).toHaveAttribute("aria-pressed", "true");
  if (!isMobile) await expect(page.getByRole("combobox", { name: "Performance" })).toHaveValue("profit");
  await search.fill("zzz-introuvable");
  await expect(page).toHaveURL(/[?&]q=zzz-introuvable/);
  await search.fill("");
  await expect(page).not.toHaveURL(/[?&]q=/);
  if (!isMobile) await page.getByRole("combobox", { name: "Performance" }).selectOption("all");

  const detail = page.locator("section").filter({ has: page.getByRole("heading", { name: "Détail des cartes" }) });
  // Étiquette de la sélection dans l'en-tête du détail : sa croix efface la sélection.
  const selectionChip = detail.getByRole("button", { name: /^Retirer le filtre/ });
  if (isMobile) {
    // Téléphone : toucher coche sans réduire la liste.
    const rows = detail.locator("ul > li");
    await expect(rows).toHaveCount(2);
    await rows.first().click({ position: { x: 150, y: 70 } });
    await expect(selectionChip).toBeVisible();
    await expect(rows).toHaveCount(2);
    await snap(page, "investissement-selection");
    await selectionChip.click();
    await expect(selectionChip).toHaveCount(0);
    await page.getByText("Comprendre les colonnes").first().click();
    await expect(
      page.getByRole("definition").filter({ hasText: "Exemplaires avec un prix Cardmarket / exemplaires possédés." }),
    ).toBeVisible();
  } else {
    // Ordinateur : la colonne triée par défaut est signalée ; un clic réduit le détail, la croix le réaffiche.
    await expect(detail.getByRole("columnheader", { name: /Marché/ })).toHaveAttribute("aria-sort", "descending");
    const rows = detail.locator("tbody > tr");
    await expect(rows).toHaveCount(2);
    await rows.first().locator("td").nth(2).click();
    await expect(selectionChip).toBeVisible();
    await expect(rows).toHaveCount(1);
    await snap(page, "investissement-selection");
    await selectionChip.click();
    await expect(selectionChip).toHaveCount(0);
    await expect(rows).toHaveCount(2);
  }
  await expectNoHorizontalScroll(page);
});

test("plusieurs exemplaires : prix unitaire sous la valeur, sur téléphone comme sur ordinateur", async ({ page, account }) => {
  const printingIds = await pricedPrintings();
  test.skip(printingIds.length < 2, "Pas assez d'historique de prix local.");
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  // Une carte en trois exemplaires, une autre seule : le prix unitaire n'apparaît que pour la première.
  await prisma.collectionItem.createMany({
    data: printingIds.map((printingId, index) => ({
      userId: account.id,
      printingId,
      conditionId: condition.id,
      quantity: index === 0 ? 3 : 1,
    })),
  });

  await ready(page, "/fr/investissement");
  const detail = page.locator("section").filter({ has: page.getByRole("heading", { name: "Détail des cartes" }) });
  const unitPrice = detail.getByText(/\/ unité$/);
  await expect(unitPrice).toHaveCount(1);
  await expect(unitPrice).toBeVisible();
  await unitPrice.scrollIntoViewIfNeeded();
  await snap(page, "investissement-prix-unitaire");
  await expectNoHorizontalScroll(page);
});
