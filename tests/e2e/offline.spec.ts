import type { Page } from "@playwright/test";
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

/** Service worker en place et écran des cartes gardé dans son cache. */
async function cardsCachedOffline(page: Page) {
  await page.goto("/fr/cards");
  await settle(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
  });
  await page.reload();
  await settle(page);
  // La fiche est chargée à la demande : ouverte une fois en ligne pour que son code soit en cache.
  await page.getByRole("button", { name: /^Adam Smasher/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();
  await settle(page);
}

async function addFromModal(page: Page, name: RegExp, isMobile: boolean) {
  await page.getByRole("button", { name }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: isMobile ? "Ajouter à ma collection" : "Ajouter", exact: true }).click();
  const line = dialog.locator("li").filter({ hasText: "En attente" });
  await expect(line).toBeVisible();
  if (isMobile) await line.getByRole("button", { name: /^Modifier la ligne/ }).click();
  return { dialog, line };
}

const pendingStatus = (page: Page) => page.getByRole("status").filter({ hasText: /modifications? en attente/ });

test("hors ligne : ajout puis modification, ajout puis suppression, envoyés après rechargement et retour du réseau", async ({
  page,
  context,
  account,
  isMobile,
}) => {
  test.skip(!prodURL, "E2E_PROD_URL absent : serveur de production non lancé.");
  await cardsCachedOffline(page);

  await context.setOffline(true);
  try {
    // Ajout puis quantité passée de 1 à 3.
    const added = await addFromModal(page, /^Adam Smasher/, isMobile);
    await added.line.getByRole("button", { name: "Augmenter la quantité" }).click();
    await added.line.getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect(added.line.getByRole("textbox", { name: "Quantité" })).toHaveValue("3");
    await page.waitForTimeout(600);
    await added.dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    // Ajout puis suppression : rien ne reste en attente pour cette carte.
    const removed = await addFromModal(page, /^Royce/, isMobile);
    await expect(pendingStatus(page)).toHaveText(/2 modifications en attente/);
    await removed.line.getByRole("button", { name: "Retirer" }).click();
    await expect(pendingStatus(page)).toHaveText(/1 modification en attente/);
    await removed.dialog.getByRole("button", { name: "Fermer", exact: true }).click();

    // Rechargement sans réseau : la modification est toujours affichée et en attente.
    await page.reload();
    await settle(page);
    await expect(pendingStatus(page)).toHaveText(/1 modification en attente/);
    await snap(page, "h-offline-en-attente");
    expect(await prisma.collectionItem.count({ where: { userId: account.id } })).toBe(0);
  } finally {
    await context.setOffline(false);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(pendingStatus(page)).toHaveCount(0, { timeout: 30_000 });
  await expect
    .poll(() => prisma.collectionItem.findMany({ where: { userId: account.id }, select: { quantity: true } }))
    .toEqual([{ quantity: 3 }]);
});
