import { prisma } from "@/lib/prisma";
import { expect, settle, snap, test } from "./fixtures";

/**
 * Mode hors-ligne : le service worker n'existe qu'en production. Lancer d'abord un serveur de prod :
 *   NEXT_DIST_DIR=.next-e2e-prod next build && NEXT_DIST_DIR=.next-e2e-prod APP_URL=http://localhost:3200 next start -p 3200
 * puis `E2E_PROD_URL=http://localhost:3200 npm run test:e2e -- offline`. Sans E2E_PROD_URL : ignoré.
 */
const prodURL = process.env.E2E_PROD_URL;

test.use({ baseURL: prodURL ?? "http://localhost:3200", serviceWorkers: "allow" });

test("hors-ligne : images téléchargées, écrans consultables sans réseau", async ({ page, context, account }) => {
  test.skip(!prodURL, "E2E_PROD_URL absent : serveur de production non lancé.");
  test.setTimeout(240_000);
  const printing = await prisma.printing.findFirstOrThrow({ where: { language: "en" } });
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  await prisma.collectionItem.create({ data: { userId: account.id, printingId: printing.id, conditionId: condition.id, quantity: 1 } });

  await page.goto("/fr/parametres");
  await settle(page);
  // Le service worker prend la main sur la page.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
  });
  const download = page.getByRole("button", { name: /^Télécharger les images/ });
  await download.click();
  // « N / N images enregistrées » : tout le catalogue est en cache.
  await expect(page.getByText(/images enregistrées sur cet appareil$/)).toHaveText(/^(\d+) \/ \1 images/, { timeout: 180_000 });
  await snap(page, "h-images-telechargees");
  const cached = await page.evaluate(async () => (await (await caches.open("cptcg-images-v1")).keys()).length);
  console.log("images en cache :", cached);
  expect(cached).toBeGreaterThan(100);

  // Visite préalable des écrans pour les mettre en cache.
  for (const path of ["/fr", "/fr/cards", "/fr/decks"]) {
    await page.goto(path);
    await settle(page);
  }

  await context.setOffline(true);
  try {
    for (const path of ["/fr", "/fr/cards", "/fr/decks", "/fr/parametres"]) {
      await page.goto(path).catch(() => undefined);
      await settle(page);
      const text = await page.locator("body").innerText();
      console.log(`hors-ligne ${path} :`, text.replace(/\s+/g, " ").slice(0, 120));
      expect(text).not.toMatch(/ERR_INTERNET_DISCONNECTED|No internet|Aucune connexion Internet|pas encore été enregistrée/i);
      await snap(page, `h-offline-${path.split("/").pop() || "accueil"}`);
    }
    await page.goto("/fr/cards");
    await settle(page);
    // Les vignettes viennent du cache : au moins une image chargée.
    const loaded = await page.locator("main img").evaluateAll((imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length);
    console.log("images affichées hors-ligne :", loaded);
    expect(loaded).toBeGreaterThan(0);
  } finally {
    await context.setOffline(false);
  }
});
