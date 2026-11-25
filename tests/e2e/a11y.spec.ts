import { expect, settle, test } from "./fixtures";

test.use({ signedIn: false });

test("titres glitch : lus une seule fois, calques toujours dessinés", async ({ page, account }) => {
  void account;
  await page.goto("/fr");
  await settle(page);
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveAccessibleName("Toutes les cartes Cyberpunk TCG, votre collection et les tournois près de chez vous");
  const layer = await title.evaluate((el) => getComputedStyle(el, "::before").content);
  expect(layer).toContain("Toutes les cartes");
});

test.describe("connecté", () => {
  test.use({ signedIn: true });

  // aria-pressed est interdit sur un lien (Lighthouse aria-allowed-attr) : l'état actif passe par aria-current.
  test("lien Paramètres : aria-current seulement sur la page des paramètres", async ({ page, account }) => {
    void account;
    await page.goto("/fr/tableau-de-bord");
    const settings = page.getByRole("link", { name: "Paramètres" });
    await expect(settings).not.toHaveAttribute("aria-current");
    await expect(settings).not.toHaveAttribute("aria-pressed");
    await settings.click();
    await expect(page).toHaveURL(/\/fr\/parametres/);
    await expect(settings).toHaveAttribute("aria-current", "page");
    await expect(settings).not.toHaveAttribute("aria-pressed");
  });

  test("catalogue : résultats et sélection du mode ajout annoncés, dialogue de sortie modal", async ({ page, account }) => {
    void account;
    await page.goto("/fr/cards");
    await settle(page);
    await expect(page.getByRole("status").filter({ hasText: /\d+ cartes?/ }).first()).toBeVisible();

    const addMode = page.getByRole("button", { name: "Mode ajout", exact: true });
    await addMode.click();
    await page.getByRole("button", { name: /^Ajouter un exemplaire de Dexter DeShawn/ }).click();
    await expect(page.getByText("1 exemplaire à ajouter")).toBeAttached();
    await expect(page.getByRole("status").filter({ hasText: /1 exemplaire · 1 carte/ })).toBeVisible();

    // Quitter avec une sélection : dialogue modal, focus sur « Rester », Échap le ferme et rend le focus.
    // Au clavier : Safari ne donne pas le focus à un bouton cliqué.
    await addMode.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Rester" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Rester" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(addMode).toBeFocused();
  });

  test("parcours débutant plein écran (téléphone) : fenêtre modale, Échap revient aux règles", async ({ page, account, isMobile }) => {
    void account;
    test.skip(!isMobile, "plein écran seulement sur téléphone");
    await page.goto("/fr/comment-jouer");
    await page.getByRole("button", { name: "Parcours débutant" }).click();
    const dialog = page.getByRole("dialog", { name: "Parcours débutant" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
