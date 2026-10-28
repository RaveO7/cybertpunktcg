import type { Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { expect, settle, test } from "./fixtures";

const CATALOG = /\/api\/catalog(\?|$)/;
const HISTORY = /\/api\/investment\/history\?(?!.*referenceDay)/;

/** Retient les réponses du catalogue jusqu'à `release()` : l'écran reste en chargement. */
async function holdCatalog(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(CATALOG, async (route) => {
    await gate;
    await route.continue().catch(() => undefined);
  });
  return release;
}

test("squelette : immobile quand l'utilisateur demande moins d'animations", async ({ page, account }) => {
  void account;
  const release = await holdCatalog(page);
  try {
    await page.goto("/fr/decks");
    const skeleton = page.locator("main [aria-busy=true]");
    await expect(skeleton).toBeVisible();
    await expect(skeleton.getByRole("status")).toHaveText("Chargement des decks…");
    const animations = () =>
      skeleton.locator(".animate-pulse").evaluateAll((blocks) => blocks.map((block) => getComputedStyle(block).animationName));

    await page.emulateMedia({ reducedMotion: "no-preference" });
    const animated = await animations();
    expect(animated.length).toBeGreaterThan(0);
    expect(animated.every((name) => name !== "none")).toBe(true);

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await animations()).toEqual(animated.map(() => "none"));
  } finally {
    release();
    await settle(page);
  }
});

test("écrans du compte : squelette et aucun « 0 » avant l'arrivée du catalogue", async ({ page, account }) => {
  void account;
  // La liste de souhaits n'est pas encore publiée (WISHLIST_ENABLED) : hors de ce parcours.
  for (const path of ["/fr", "/fr/investissement", "/fr/decks", "/fr/parametres"]) {
    const release = await holdCatalog(page);
    try {
      await page.goto(path);
      const main = page.locator("main");
      await expect(main.locator("[aria-busy=true]"), path).toBeVisible();
      await expect(main.getByRole("status"), path).toHaveText(/^Chargement/);
      expect(await main.innerText(), path).not.toMatch(/\b0\b/);
    } finally {
      release();
    }
    // Données arrivées : le squelette laisse place à l'écran.
    await expect(page.locator("main [aria-busy=true]"), path).toHaveCount(0);
    await settle(page);
    await page.unroute(CATALOG);
  }
});

test("historique de prix en échec : « Réessayer » puis la courbe", async ({ page, account }) => {
  // Collection vide : la page invite à ajouter des cartes, sans courbe. Une carte suffit (supprimée avec le compte).
  const printing = await prisma.printing.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  await prisma.collectionItem.create({
    data: { userId: account.id, printingId: printing.id, conditionId: condition.id, quantity: 1 },
  });
  let fail = true;
  await page.route(HISTORY, (route) => (fail ? route.fulfill({ status: 500, body: "{}" }) : route.continue()));
  await page.goto("/fr/investissement");
  const error = page.getByRole("alert").filter({ hasText: "Impossible de charger l’historique des prix." });
  await expect(error).toBeVisible();
  const retry = error.getByRole("button", { name: "Réessayer" });
  fail = false;
  const reloaded = page.waitForResponse((response) => HISTORY.test(response.url()) && response.ok());
  await retry.click();
  await reloaded;
  await expect(error).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Réessayer" })).toHaveCount(0);
  await settle(page);
});

test("catalogue en échec : « Réessayer » recharge l'écran", async ({ page, account }) => {
  void account;
  let fail = true;
  await page.route(CATALOG, (route) => (fail ? route.fulfill({ status: 500, body: "{}" }) : route.continue()));
  await page.goto("/fr/decks");
  const error = page.getByRole("alert").filter({ hasText: "Impossible de charger la collection." });
  const retry = error.getByRole("button", { name: "Réessayer" });
  await expect(retry).toBeVisible();
  fail = false;
  await retry.click();
  await expect(page.getByRole("heading", { level: 1, name: "Decks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toHaveCount(0);
  await settle(page);
});
