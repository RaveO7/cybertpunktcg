import { prisma } from "@/lib/prisma";
import { BETA_SET_CODE, SEALED_SET_PREFIX } from "@/lib/reference-data";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

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

test("fiche carte ouverte : la barre du bas mène directement à une autre section", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "barre du bas : téléphone seulement");
  void account;
  await page.goto("/fr/cards");
  await settle(page);
  await page.locator("[data-card-id] > button").first().tap();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Le reste de la page est inerte, mais pas la barre de navigation du bas.
  const nav = page.getByRole("navigation", { name: "Sections" });
  expect(await nav.evaluate((element) => element.closest("[inert]") === null)).toBe(true);
  await nav.getByRole("link", { name: "Decks" }).tap();
  await expect(page).toHaveURL(/\/fr\/decks/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("recherche : une faute de frappe trouve quand même la carte", async ({ page, account }) => {
  void account;
  await page.goto("/fr/cards");
  await settle(page);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("searchbox", { name: "Rechercher" }).fill("strretkid");
  await expect(page.getByRole("button", { name: /^V Streetkid/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Adam Smasher/ })).toHaveCount(0);
});
