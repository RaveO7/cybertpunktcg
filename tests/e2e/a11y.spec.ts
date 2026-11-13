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
});
