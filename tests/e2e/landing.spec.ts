import type { Page } from "@playwright/test";
import { expect, settle, test } from "./fixtures";

/**
 * Accueil des visiteurs (spec site/landing) : haut de page lisible dès le premier affichage, donne de
 * l'éventail sans JavaScript, interactions une fois le script chargé (survol seulement après la donne),
 * aucun mouvement si l'utilisateur préfère réduire les animations, pas de code d'autres écrans.
 * Aucune donnée créée (pas de compte).
 */
test.use({ signedIn: false });

const title = (page: Page) => page.getByRole("heading", { level: 1 });
const fanCards = (page: Page) => page.locator(".hero-fan-card");

/** Opacité effective d'un élément : produit de la sienne et de celles de ses ancêtres. */
function effectiveOpacity(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  });
}

/** Animations encore actives dans l'éventail (donne et glitch de fin). */
function dealAnimations(page: Page) {
  return page.locator(".hero-fan-deal").evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState !== "finished").length);
}

test.describe("sans JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("titre opaque dès le départ, cartes distribuées puis posées en éventail", async ({ page }) => {
    await page.goto("/fr", { waitUntil: "commit" });
    await fanCards(page).first().waitFor({ state: "attached" });
    // Dès le premier rendu : jamais d'opacité nulle sur le haut de page, même pendant son glissé.
    for (const selector of ["h1", "[data-glitch='hero-eyebrow']"]) expect(await effectiveOpacity(page, selector)).toBe(1);
    await expect(title(page)).toBeVisible();
    // La donne est jouée sans script : chaque carte porte l'animation de vol (lue sur le style calculé,
    // indépendamment du moment où le serveur de test, plus ou moins lent, livre la page).
    const names = await fanCards(page).evaluateAll((cards) => cards.map((card) => getComputedStyle(card).animationName));
    expect(names).toHaveLength(5);
    for (const name of names) expect(name).toContain("hero-fan-deal");
    // Donne finie : cartes visibles, posées de gauche à droite dans le cadre de l'éventail.
    await expect.poll(() => dealAnimations(page), { timeout: 5_000 }).toBe(0);
    const frame = (await page.locator(".hero-fan-deal").boundingBox())!;
    const lefts: number[] = [];
    for (const card of await fanCards(page).all()) {
      expect(await card.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
      const box = (await card.boundingBox())!;
      expect(box.y).toBeLessThan(frame.y + frame.height / 2);
      lefts.push(box.x);
    }
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  });
});

test.describe("avec JavaScript", () => {
  test("survol après la donne, fiche ouverte puis refermée, carrousel et onglets actifs", async ({ page, isMobile }) => {
    // Pas de code propre à un autre écran : la bibliothèque de QR code des tournois n'est pas chargée.
    const scripts: Promise<string>[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "script") scripts.push(response.text());
    });
    await page.goto("/fr", { waitUntil: "commit" });
    const hit = page.locator(".hero-fan-hit").nth(2);
    const deal = page.locator(".hero-fan-deal");
    await deal.waitFor({ state: "attached" });
    if (!isMobile) {
      // Pendant la donne (figée le temps de la vérification, quelle que soit la vitesse du serveur), le
      // survol ne soulève pas la carte, que le script soit déjà hydraté ou non.
      await deal.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => animation.pause()));
      await settle(page);
      await hit.locator("a").hover();
      await page.mouse.move(640, 300, { steps: 3 });
      await hit.locator("a").hover();
      await expect(hit).not.toHaveAttribute("data-active");
      await deal.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => animation.play()));
    }
    await expect.poll(() => dealAnimations(page), { timeout: 10_000 }).toBe(0);
    await settle(page);
    if (!isMobile) {
      // Après la donne et l'hydratation, le survol soulève la carte.
      await page.mouse.move(0, 0);
      await expect(async () => {
        await hit.locator("a").hover();
        await expect(hit).toHaveAttribute("data-active", "true", { timeout: 500 });
      }).toPass({ timeout: 10_000 });
    }
    await hit.locator("a").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/fr\/?$/);
    for (const body of await Promise.all(scripts)) expect(body).not.toContain("Invalid QR Code version");

    // Carrousel des modules : un clic sur un autre module l'affiche.
    const tabs = page.getByRole("tablist", { name: "Aperçu" }).getByRole("tab");
    await tabs.nth(2).scrollIntoViewIfNeeded();
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");

    // Onglets Tournois / Boutiques.
    const shops = page.getByRole("tab", { name: "Boutiques", exact: true });
    await shops.scrollIntoViewIfNeeded();
    await shops.click();
    await expect(shops).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("mouvement réduit", () => {
  test.use({ reducedMotion: "reduce" });

  test("aucune animation : textes et éventail ouverts d'emblée", async ({ page }) => {
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await expect(title(page)).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await effectiveOpacity(page, ".hero-fan-card")).toBe(1);
  });
});
