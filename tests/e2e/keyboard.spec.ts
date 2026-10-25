import { prisma } from "@/lib/prisma";
import { expect, settle, test } from "./fixtures";

// Champ texte focalisé (clavier ouvert, barre du bas masquée) puis tap direct sur le bouton d'envoi.
test("tap sur Créer juste après avoir saisi le nom du tournoi", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "clavier virtuel et tap : téléphone seulement");
  await page.goto("/fr/tournois");
  await settle(page);
  await expect(page.getByText("Chargement…")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Nom du tournoi" }).tap();
  await page.getByRole("textbox", { name: "Nom du tournoi" }).fill("Clavier E2E");
  const btn = page.getByRole("button", { name: "Créer", exact: true });
  await btn.scrollIntoViewIfNeeded();
  const nav = await page.getByRole("navigation", { name: "Sections" }).count();
  console.log(test.info().project.name, "barre du bas visible pendant la saisie :", nav > 0);
  try {
    await btn.tap();
    await expect(page).toHaveURL(/\/tournois\/c/, { timeout: 8000 });
  } finally {
    await prisma.tournament.deleteMany({ where: { organizers: { some: { userId: account.id } } } });
  }
});

/** Éléments focalisables visibles de la fenêtre, dans l'ordre de tabulation du document. */
async function dialogFocusables(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector("[role=dialog][aria-modal=true]");
    if (!dialog) return [];
    const selector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";
    return Array.from(dialog.querySelectorAll<HTMLElement>(selector))
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0)
      .map((element) => {
        element.dataset.e2eFocus ??= String(Math.random());
        return element.dataset.e2eFocus;
      });
  });
}

function activeFocusId(page: import("@playwright/test").Page) {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.e2eFocus ?? null);
}

test("fiche carte : Tab boucle dans la fiche, Échap la ferme et rend le focus à la tuile", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "clavier physique : ordinateur seulement");
  void account;
  await page.goto("/fr/cards");
  await settle(page);
  const tile = page.locator("[data-card-id] > button").first();
  await expect(tile).toBeVisible();
  await tile.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Fermer" })).toBeFocused();
  // Arrière-plan inerte : la tuile ne peut plus recevoir le focus.
  expect(await tile.evaluate((element) => element.closest("[inert]") !== null)).toBe(true);

  const ids = await dialogFocusables(page);
  expect(ids.length).toBeGreaterThan(1);
  // Dernier élément → Tab → premier élément, et inversement avec Maj+Tab.
  await page.locator(`[data-e2e-focus="${ids[ids.length - 1]}"]`).focus();
  await page.keyboard.press("Tab");
  expect(await activeFocusId(page)).toBe(ids[0]);
  await page.keyboard.press("Shift+Tab");
  expect(await activeFocusId(page)).toBe(ids[ids.length - 1]);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(tile).toBeFocused();
});

test("confirmation sur un deck : Échap ne ferme que la confirmation", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "clavier physique : ordinateur seulement");
  await page.goto("/fr/decks");
  await settle(page);
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await page.waitForURL(/deck=/);
  await settle(page);

  const remove = page.getByRole("button", { name: "Supprimer", exact: true });
  await remove.focus();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Annuler" })).toBeFocused();
  // L'éditeur derrière est inerte tant que la confirmation est ouverte.
  expect(await remove.evaluate((element) => element.closest("[inert]") !== null)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(page).toHaveURL(/deck=/);
  await expect(remove).toBeFocused();
  expect(await prisma.deck.count({ where: { userId: account.id } })).toBe(1);
});

test("sélection au clavier : Espace puis Maj+Flèche droite sélectionnent 3 cartes", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "clavier physique : ordinateur seulement");
  void account;
  await page.goto("/fr/cards");
  await settle(page);
  await expect(page.locator("[data-card-id]").first()).toBeVisible();

  // La touche S, depuis une carte, active le mode sélection (et le mode ajout qui la porte).
  const first = page.locator("[data-card-id] > button").first();
  await first.focus();
  await page.keyboard.press("s");
  const addMode = page.getByRole("button", { name: "Mode ajout", exact: true });
  await expect(addMode).toHaveAttribute("aria-pressed", "true");
  await expect(first).toBeFocused();

  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator("[data-card-id] > button[aria-pressed=true]")).toHaveCount(3);
  await expect(page.getByText("3 cartes sélectionnées", { exact: true })).toBeAttached();
  // Aucune fiche ni feuille d'ajout ouverte par Espace.
  await expect(page.getByRole("dialog")).toHaveCount(0);

});
