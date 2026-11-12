import { expect, settle, test } from "./fixtures";

// En-tête d'une page réservée aux comptes : même hauteur avant et après l'arrivée de la session, sinon
// toute la page (<main>) descend au chargement (CLS mesuré jusqu'à 0,98 par Lighthouse).
for (const path of ["/fr/investissement", "/fr/parametres"]) {
  test(`l'en-tête ne change pas de hauteur au chargement de ${path}`, async ({ page, account }) => {
    expect(account.id).toBeTruthy();
    // Session vérifiée lentement : l'état « session inconnue » dure assez pour être rendu.
    await page.route("**/api/collection", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page.addInitScript(() => {
      const heights: number[] = [];
      Object.assign(window, { __headerHeights: heights });
      new MutationObserver((_, observer) => {
        const header = document.querySelector("header");
        if (!header) return;
        observer.disconnect();
        new ResizeObserver(([entry]) => heights.push(Math.round(entry.borderBoxSize[0].blockSize))).observe(header);
      }).observe(document, { childList: true, subtree: true });
    });

    await page.goto(path);
    await expect(page.locator("header").getByRole("link", { name: "Paramètres" })).toBeVisible();
    await settle(page);

    const heights = await page.evaluate(() => (window as unknown as { __headerHeights: number[] }).__headerHeights);
    expect(heights.length).toBeGreaterThan(0);
    expect(new Set(heights).size, `hauteurs successives de l'en-tête : ${heights.join(", ")}`).toBe(1);
  });
}
