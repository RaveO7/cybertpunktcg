import { prisma } from "@/lib/prisma";
import { expect, settle, test } from "./fixtures";

// En-tête d'une page réservée aux comptes : même hauteur avant et après l'arrivée de la session, sinon
// toute la page (<main>) descend au chargement (CLS mesuré jusqu'à 0,98 par Lighthouse).
// « /fr » connecté : tableau de bord, servi à l'adresse de l'accueil mais réservé aux comptes (CLS 0,178).
for (const path of ["/fr", "/fr/investissement", "/fr/parametres"]) {
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

/** Deux impressions qui ont un prix et un historique dans le catalogue local (lecture seule). */
async function pricedPrintings() {
  const snapshots = await prisma.priceSnapshot
    .findMany({ distinct: ["printingId"], select: { printingId: true }, take: 2, orderBy: { printingId: "asc" } })
    .catch(() => []);
  return snapshots.map((snapshot) => snapshot.printingId);
}

// Chaque état de chargement rendu assez longtemps (session, courbe, prix de référence) : aucun ne doit
// avoir une autre taille que le contenu qui le remplace. API layout-shift : Chromium seulement.
for (const path of ["/fr", "/fr/investissement", "/fr/parametres"]) {
  test(`aucun décalage de mise en page au chargement de ${path}`, async ({ page, account, browserName }) => {
    test.skip(browserName !== "chromium", "PerformanceObserver layout-shift : Chromium seulement.");
    const printingIds = await pricedPrintings();
    test.skip(printingIds.length < 2, "Pas assez d'historique de prix local.");
    const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
    for (const printingId of printingIds) {
      await prisma.collectionItem.create({
        data: { userId: account.id, printingId, conditionId: condition.id, quantity: 1, purchasePrice: 0.05, purchaseCurrency: "EUR" },
      });
    }
    for (const api of ["**/api/collection", "**/api/investment/history**"]) {
      await page.route(api, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      });
    }
    await page.addInitScript(() => {
      const shifts: string[] = [];
      Object.assign(window, { __shifts: shifts });
      new PerformanceObserver((list) => {
        type Source = { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly };
        for (const entry of list.getEntries() as unknown as { value: number; sources: Source[] }[]) {
          const rect = (r: DOMRectReadOnly) => `${Math.round(r.y)}/${Math.round(r.height)}`;
          const nodes = entry.sources
            .map((source) => {
              const element = source.node as Element | undefined;
              const name = `${element?.tagName ?? "?"}.${element?.className.toString().split(" ").slice(0, 3).join(".") ?? ""}`;
              return `${name} ${rect(source.previousRect)}→${rect(source.currentRect)}`;
            })
            .join(" + ");
          shifts.push(`${entry.value.toFixed(4)} ${nodes}`);
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto(path);
    await expect(page.locator("header").getByRole("link", { name: "Paramètres" })).toBeVisible();
    await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
    await settle(page);

    const shifts = await page.evaluate(() => (window as unknown as { __shifts: string[] }).__shifts);
    const total = shifts.reduce((sum, shift) => sum + Number(shift.split(" ")[0]), 0);
    expect(total, `décalages : ${shifts.join(", ")}`).toBeLessThan(0.01);
  });
}
