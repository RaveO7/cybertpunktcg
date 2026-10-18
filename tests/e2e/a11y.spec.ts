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
