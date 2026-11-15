import { expect, settle, test } from "./fixtures";

/**
 * Catalogue public, rendu allégé : toutes les cartes sont dans le HTML serveur (liens et noms, pour les
 * moteurs), mais seules les 20 premières tuiles ont leur image au chargement ; la suite passe en tuile
 * complète par paquets à l'approche de l'écran. Visiteur : rien n'est créé en base.
 */

test.use({ signedIn: false });

test("catalogue : toutes les cartes dans le HTML, images affichées par paquets", async ({ page, request }) => {
  const html = await (await request.get("/fr/cartes")).text();
  const serverLinks = new Set(html.match(/href="\/fr\/cartes\/[^"]+"/g) ?? []);
  test.skip(serverLinks.size <= 40, "Pas assez de cartes dans le catalogue local.");

  await page.goto("/fr/cartes");
  await settle(page);
  const tiles = page.locator("main ul.grid > li");
  const withImage = tiles.filter({ has: page.locator("a img") });
  // Chaque carte garde sa tuile et son lien ; seules les premières ont déjà leur image.
  await expect(tiles).toHaveCount(serverLinks.size);
  await expect(page.locator("main ul.grid a[href^='/fr/cartes/']")).toHaveCount(serverLinks.size);
  await expect(withImage).toHaveCount(20);

  // En descendant, les images arrivent d'elles-mêmes, paquet par paquet, jusqu'à la dernière carte.
  const pending = tiles.filter({ hasNot: page.locator("a img") });
  await expect(async () => {
    if ((await pending.count()) > 0) await pending.first().scrollIntoViewIfNeeded({ timeout: 1_000 });
    await expect(withImage).toHaveCount(serverLinks.size, { timeout: 1_000 });
  }).toPass();

  // Le lien d'une tuile ouvre toujours la fiche.
  const last = tiles.last().getByRole("link");
  const href = await last.getAttribute("href");
  await last.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});
