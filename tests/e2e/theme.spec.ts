import type { Page } from "@playwright/test";
import { THEME_CHROME_COLORS } from "@/lib/preferences";
import { expect, snap, test } from "./fixtures";

async function expectChrome(page: Page, theme: "dark" | "light") {
  const metas = page.locator('meta[name="theme-color"]');
  await expect(metas).toHaveCount(1);
  await expect(metas).toHaveAttribute("content", THEME_CHROME_COLORS[theme]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

// Le téléphone est en thème clair (colorScheme du projet) : la barre suit l'application, pas le système.
test("theme-color suit le thème de l'application", async ({ page, account }) => {
  void account;
  expect(THEME_CHROME_COLORS).toEqual({ dark: "#07080d", light: "#e8eef6" });

  await page.goto("/fr");
  await expectChrome(page, "dark");

  await page.goto("/fr/parametres");
  await expectChrome(page, "dark");
  await page.getByRole("button", { name: "Clair", exact: true }).click();
  await expectChrome(page, "light");
  await snap(page, "theme-clair");

  await page.reload();
  await expectChrome(page, "light");
});
