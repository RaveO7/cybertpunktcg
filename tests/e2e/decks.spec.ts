import { prisma } from "@/lib/prisma";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

test("un deck créé par l'interface apparaît dans la liste", async ({ page, account }) => {
  void account;
  await page.goto("/fr/decks");
  await expect(page.getByRole("heading", { name: "Decks" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Le deck est créé tout de suite et ouvert dans l'éditeur ; il part avec le compte.
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await expect(page).toHaveURL(/[?&]deck=/);
  const deckId = new URL(page.url()).searchParams.get("deck");
  expect(deckId).toBeTruthy();
  await expectNoHorizontalScroll(page);
  await snap(page, "decks-editeur");

  await page.getByRole("link", { name: "Mes decks" }).click();
  await expect(page.locator(`a[href*="deck=${deckId}"]`)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snap(page, "decks-liste");
});

test("une modification de deck n'est pas perdue si l'on quitte la page aussitôt", async ({ page, account }) => {
  await page.goto("/fr/decks");
  await settle(page);
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await page.waitForURL(/deck=/);
  await settle(page);
  await page.getByRole("button", { name: "Ajouter un exemplaire de V: Streetkid" }).click();
  // Départ avant la fin du délai de 600 ms : seul l'envoi au « pagehide » peut l'enregistrer.
  await page.goto("about:blank");
  await expect
    .poll(() => prisma.deckCard.count({ where: { deck: { userId: account.id } } }), { timeout: 10_000 })
    .toBe(1);
});
