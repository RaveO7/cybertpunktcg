import type { Locator, Page, Route } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { expect, settle, snap, test } from "./fixtures";

/**
 * Modifications de la collection sans réseau : elles s'affichent tout de suite, attendent dans la file de
 * l'appareil et partent au retour du réseau. Ici les requêtes de la collection sont coupées (sans service
 * worker, une page hors ligne ne se recharge pas) ; le rechargement hors ligne est testé dans offline.spec.ts.
 * Tout ce qui est créé appartient au compte de test, supprimé avec lui.
 */

const COLLECTION_API = /\/api\/collection(\/|\?|$)/;
const cut = (route: Route) => route.abort("internetdisconnected");

async function ready(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
}

/** Ouvre la fiche de la carte et ajoute un exemplaire ; renvoie la fiche. */
async function addFromModal(page: Page, name: RegExp, isMobile: boolean) {
  await page.getByRole("button", { name }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: isMobile ? "Ajouter à ma collection" : "Ajouter", exact: true }).click();
  return dialog;
}

/** Ligne de la fiche marquée « En attente », commandes d'édition affichées (sur téléphone, derrière un bouton). */
async function pendingLine(dialog: Locator, isMobile: boolean) {
  const line = dialog.locator("li").filter({ hasText: "En attente" });
  await expect(line).toBeVisible();
  if (isMobile) await line.getByRole("button", { name: /^Modifier la ligne/ }).click();
  return line;
}

const pendingStatus = (page: Page) => page.getByRole("status").filter({ hasText: /modifications? en attente/ });

test("hors ligne : indicateur des modifications en attente, confirmation de déconnexion, envoi au retour du réseau", async ({
  page,
  account,
  isMobile,
}) => {
  await ready(page, "/fr/cards");
  await page.route(COLLECTION_API, cut);

  const dialog = await addFromModal(page, /^Adam Smasher/, isMobile);
  await expect(pendingStatus(page)).toHaveText(/1 modification en attente/);
  // Ligne créée hors ligne puis modifiée : une seule modification en attente.
  const line = await pendingLine(dialog, isMobile);
  await line.getByRole("button", { name: "Augmenter la quantité" }).click();
  await expect(line.getByRole("textbox", { name: "Quantité" })).toHaveValue("2");
  await page.waitForTimeout(600);
  await expect(pendingStatus(page)).toHaveText(/1 modification en attente/);
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await addFromModal(page, /^Royce/, isMobile);
  await expect(pendingStatus(page)).toHaveText(/2 modifications en attente/);
  await snap(page, "o-sync-en-attente");
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();

  // Déconnexion avec des modifications en attente : confirmation, refusée ici.
  await page.getByRole("link", { name: "Paramètres" }).click();
  await expect(page).toHaveURL(/\/fr\/parametres/);
  const logout = page.getByRole("button", { name: "Se déconnecter" });
  await expect(logout).toBeVisible();
  let message = "";
  page.once("dialog", (confirm) => {
    message = confirm.message();
    void confirm.dismiss();
  });
  await logout.click();
  await expect.poll(() => message).toMatch(/2 modifications n’ont pas encore été envoyées et seront perdues/);
  await expect(logout).toBeVisible();
  await expect(pendingStatus(page)).toHaveText(/2 modifications en attente/);
  expect(await prisma.collectionItem.count({ where: { userId: account.id } })).toBe(0);

  // Retour du réseau : la file part, l'indicateur disparaît.
  await page.unroute(COLLECTION_API);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(pendingStatus(page)).toHaveCount(0, { timeout: 30_000 });
  await expect
    .poll(() =>
      prisma.collectionItem.findMany({ where: { userId: account.id }, select: { quantity: true }, orderBy: { quantity: "desc" } }),
    )
    .toEqual([{ quantity: 2 }, { quantity: 1 }]);
});

test("hors ligne : ajout puis suppression, rien n'est créé sur le serveur", async ({ page, account, isMobile }) => {
  await ready(page, "/fr/cards");
  await page.route(COLLECTION_API, cut);
  const dialog = await addFromModal(page, /^Adam Smasher/, isMobile);
  const line = await pendingLine(dialog, isMobile);
  await line.getByRole("button", { name: "Retirer" }).click();
  await expect(dialog.locator("li").filter({ hasText: "En attente" })).toHaveCount(0);
  await expect(pendingStatus(page)).toHaveCount(0);
  await page.unroute(COLLECTION_API);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await settle(page);
  expect(await prisma.collectionItem.count({ where: { userId: account.id } })).toBe(0);
});
