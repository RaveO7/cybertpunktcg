import type { Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

/**
 * Page Investissement : vente d'exemplaires (plus-value réalisée, annulation), alerte de revente, achat en
 * devise et plus fortes variations. Les exemplaires, ventes et alertes appartiennent au compte du test,
 * supprimé à la fin (cascade).
 */

async function ready(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
}

/** Impressions qui ont un prix Cardmarket dans le catalogue local (lecture seule). */
async function pricedPrintings(count: number) {
  const prices = await prisma.price
    .findMany({
      where: { kind: "trend", source: { code: "cardmarket" }, amount: { gt: 0.5 } },
      distinct: ["printingId"],
      select: { printingId: true },
      take: count,
      orderBy: { printingId: "asc" },
    })
    .catch(() => []);
  return prices.map((price) => price.printingId);
}

async function addLine(userId: string, printingId: string, data: { quantity: number; purchasePrice?: number; purchaseCurrency?: string; purchasedAt?: string }) {
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  await prisma.collectionItem.create({
    data: {
      userId,
      printingId,
      conditionId: condition.id,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice ?? null,
      purchaseCurrency: data.purchasePrice == null ? null : (data.purchaseCurrency ?? "EUR"),
      purchasedAt: data.purchasedAt ? new Date(`${data.purchasedAt}T00:00:00.000Z`) : null,
    },
  });
}

const detailSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "Détail des cartes" }) });

test("vente : plus-value réalisée, liste des ventes, puis annulation", async ({ page, account }) => {
  const [printingId] = await pricedPrintings(1);
  test.skip(!printingId, "Aucun prix local.");
  await addLine(account.id, printingId, { quantity: 2, purchasePrice: 0.05 });

  await ready(page, "/fr/investissement");
  await detailSection(page).getByRole("button", { name: /^Vendre / }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Prix de vente total").fill("10");
  await dialog.getByLabel("Frais (port, commission)").fill("1,50");
  // Aperçu : 8,50 € nets, prix de revient de 0,05 € pour un exemplaire.
  await expect(dialog.getByText("8,50 €")).toBeVisible();
  await snap(page, "investissement-vente-fenetre");
  await dialog.getByRole("button", { name: "Enregistrer la vente" }).click();
  await expect(dialog).toHaveCount(0);

  const sales = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ventes", exact: true }) });
  await expect(sales).toBeVisible();
  await expect(page.getByText("Plus-value réalisée", { exact: true })).toBeVisible();
  await expect(page.getByText("+8,45 €").first()).toBeVisible();
  await expect(detailSection(page).getByText("×1").first()).toBeVisible();
  await sales.scrollIntoViewIfNeeded();
  await snap(page, "investissement-ventes");
  await expectNoHorizontalScroll(page);

  // Annulation en deux temps : les exemplaires reviennent dans la collection.
  await sales.getByRole("button", { name: /^Annuler la vente de / }).click();
  await sales.getByRole("button", { name: "Confirmer : remettre en collection" }).click();
  await expect(page.getByRole("heading", { name: "Ventes", exact: true })).toHaveCount(0);
  await expect(detailSection(page).getByText("×2").first()).toBeVisible();
  expect(await prisma.collectionSale.count({ where: { userId: account.id } })).toBe(0);
});

test("alerte de revente : cible atteinte signalée sur la ligne, puis supprimée", async ({ page, account }) => {
  const [printingId] = await pricedPrintings(1);
  test.skip(!printingId, "Aucun prix local.");
  await addLine(account.id, printingId, { quantity: 1, purchasePrice: 0.05 });

  await ready(page, "/fr/investissement");
  const alertButton = detailSection(page).getByRole("button", { name: /^Alerte de revente pour / }).first();
  await alertButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "PRU +25 %" })).toBeVisible();
  // Cible sous le prix actuel : atteinte tout de suite.
  await dialog.getByLabel("Prix de revente visé (EUR)").fill("0,10");
  await snap(page, "investissement-alerte-fenetre");
  await dialog.getByRole("button", { name: "Enregistrer l’alerte" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(alertButton).toContainText("Atteint");
  await snap(page, "investissement-alerte-atteinte");

  await alertButton.click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer l’alerte" }).click();
  await expect(alertButton).toHaveText("Alerte");
  expect(await prisma.sellAlert.count({ where: { userId: account.id } })).toBe(0);
});

test("achat en devise converti en euros, plus fortes variations et concentration", async ({ page, account }) => {
  const printingIds = await pricedPrintings(2);
  test.skip(printingIds.length < 2, "Pas assez de prix locaux.");
  await addLine(account.id, printingIds[0], { quantity: 1, purchasePrice: 2, purchaseCurrency: "USD", purchasedAt: "2025-06-02" });
  await addLine(account.id, printingIds[1], { quantity: 3, purchasePrice: 0.1 });

  await ready(page, "/fr/investissement");
  // Taux BCE importés : équivalent en euros sous l'achat ; sinon l'achat est signalé comme non converti.
  await expect(
    detailSection(page).getByText(/^≈ /).first().or(page.getByText(/achat en devise n’a pas encore de taux de change/)),
  ).toBeVisible();
  const movers = page.locator("section").filter({ has: page.getByRole("heading", { name: "Plus fortes variations" }) });
  await expect(movers).toBeVisible();
  await expect(movers.getByText(/représentent .* de la valeur/)).toBeVisible();
  await movers.scrollIntoViewIfNeeded();
  await snap(page, "investissement-variations");
  await expectNoHorizontalScroll(page);
});
