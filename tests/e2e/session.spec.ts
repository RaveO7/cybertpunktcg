import { prisma } from "@/lib/prisma";
import { expect, settle, snap, test } from "./fixtures";
import { requireRunId, runClientIp } from "./setup/paths";

/** Tableau de bord connecté : la case « Cartes uniques » n'existe que pour un compte. */
const dashboard = (page: import("@playwright/test").Page) => page.getByText("Cartes uniques", { exact: true });
const passwordField = (page: import("@playwright/test").Page) => page.locator('input[name="password"]');

// La connexion par l'écran incrémente le compteur `login:e2e-<runId>` : supprimé après chaque test.
test.afterEach(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { endsWith: `:${runClientIp(requireRunId())}` } } });
});

test.describe("connexion par l'écran", () => {
  test.use({ signedIn: false });

  test("la session tient après rechargement et dans un nouvel onglet", async ({ page, context, account }) => {
    await page.goto("/fr/connexion");
    await page.getByRole("tab", { name: "Se connecter" }).click();
    await page.locator('input[name="email"]').fill(account.email);
    await passwordField(page).fill(account.password);
    await snap(page, "session-connexion");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/fr\/?$/);
    await expect(dashboard(page)).toBeVisible();
    await snap(page, "session-tableau-de-bord");

    await page.reload();
    await expect(dashboard(page)).toBeVisible();
    await expect(passwordField(page)).toHaveCount(0);

    const tab = await context.newPage();
    await tab.goto("/fr");
    await expect(dashboard(tab)).toBeVisible();
    await expect(passwordField(tab)).toHaveCount(0);
    await tab.close();
  });

  test("un visiteur n'interroge pas sa session sur les pages publiques", async ({ page }) => {
    const collectionCalls: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/collection") collectionCalls.push(page.url());
    });

    await page.goto("/fr/cartes");
    const cardHref = await page.locator('a[href^="/fr/cartes/"]').first().getAttribute("href");
    for (const path of ["/fr", "/fr/cartes", cardHref ?? "", "/fr/connexion", "/fr/cgu"]) {
      expect(path).not.toBe("");
      await page.goto(path);
      await settle(page);
    }
    expect(collectionCalls).toEqual([]);

    // Page réservée aux comptes : la session y est vérifiée (cookie absent → écran de connexion).
    await page.goto("/fr/decks");
    await expect(passwordField(page)).toBeVisible();
    expect(collectionCalls).toHaveLength(1);
  });
});

test("une session supprimée en base renvoie à l'écran de connexion", async ({ page, account }) => {
  await page.goto("/fr");
  await expect(dashboard(page)).toBeVisible();
  await settle(page);

  await prisma.session.deleteMany({ where: { userId: account.id } });
  await page.reload();
  await expect(passwordField(page)).toBeVisible();
  await expect(dashboard(page)).toHaveCount(0);
  await snap(page, "session-expiree");
});
