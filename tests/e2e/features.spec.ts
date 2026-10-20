import type { Locator, Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { requireRunId, runClientIp } from "./setup/paths";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

/**
 * Parcours fonctionnels sur téléphone et sur ordinateur. Tout ce qui est créé appartient au compte de test (supprimé
 * avec lui) ; les tournois et boutiques créés sont supprimés explicitement en fin de test.
 */

/** Ferme le clavier virtuel (blur) avant d'appuyer : sinon la barre du bas réapparaît sous le doigt. */
async function press(page: Page, target: Locator) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(150);
  await target.click();
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  await expect(page.getByText("Chargement…")).toHaveCount(0, { timeout: 30_000 });
  // Écrans du compte : squelette jusqu'à l'arrivée des données.
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
}

test("collection : ajout depuis la fiche, puis par sélection multiple", async ({ page, account, isMobile }) => {
  await ready(page, "/fr/cards");
  await page.getByRole("button", { name: /^Adam Smasher/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectNoHorizontalScroll(page);
  await dialog.getByRole("button", { name: "Augmenter la quantité" }).click();
  await expect(dialog.getByRole("textbox", { name: "Quantité" })).toHaveValue("2");
  // Ordinateur : formulaire compact de la fiche, bouton icône « Ajouter ».
  await dialog.getByRole("button", { name: isMobile ? "Ajouter à ma collection" : "Ajouter", exact: true }).click();
  await expect.poll(() => prisma.collectionItem.aggregate({ where: { userId: account.id }, _sum: { quantity: true } }).then((r) => r._sum.quantity)).toBe(2);
  await snap(page, "f-collection-fiche");
  await dialog.getByRole("button", { name: "Carte suivante" }).click();
  await expect(dialog.getByRole("heading", { level: 2 })).not.toHaveText(/Adam Smasher/);
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Mode ajout" }).click();
  // Mode ajout : le clic sur la carte ouvre l'ajout rapide ; le bouton + de la carte la met dans la sélection.
  await page.getByRole("button", { name: /^Ajouter un exemplaire de Dexter DeShawn/ }).click();
  await page.getByRole("button", { name: /^Ajouter un exemplaire de Royce/ }).first().click();
  await snap(page, "f-collection-selection");
  await page.getByRole("button", { name: "Ajouter la sélection" }).click();
  await expect.poll(() => prisma.collectionItem.aggregate({ where: { userId: account.id }, _sum: { quantity: true } }).then((r) => r._sum.quantity)).toBe(4);

  // Recherche et tableau de bord.
  await page.getByRole("button", { name: "Mode ajout" }).click();
  await page.getByRole("searchbox", { name: "Rechercher" }).fill("Royce");
  await expect(page.getByRole("button", { name: /^Royce/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Adam Smasher/ })).toHaveCount(0);
  await ready(page, "/fr");
  await expect(page.getByText("Cartes uniques", { exact: true })).toBeVisible();
  await snap(page, "f-dashboard");
  await ready(page, "/fr/investissement");
  await expect(page.getByText(/0 \/ 0/)).toHaveCount(0);
  await snap(page, "f-investissement");
});

test("decks : créer, renommer, ajouter des cartes, supprimer", async ({ page, account, isMobile }) => {
  page.on("dialog", (d) => void d.accept());
  await ready(page, "/fr/decks");
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await page.waitForURL(/deck=/);
  await settle(page);
  const name = page.getByRole("textbox", { name: "Nom du deck" });
  await name.fill("Deck E2E");
  await press(page, page.getByRole("button", { name: "Ajouter un exemplaire de V: Streetkid" }));
  // Les légendes sont limitées à un exemplaire : on ajoute les deux premiers boutons encore actifs.
  for (let i = 0; i < 2; i++) await page.locator("button[aria-label^='Ajouter un exemplaire de']:not([disabled])").first().click();
  // Téléphone : onglet « Deck N » à ouvrir ; ordinateur (lg:) : le deck est une colonne toujours affichée.
  if (isMobile) await expect(page.getByRole("tab", { name: /^Deck [1-9]/ })).toBeVisible();
  else await expect(page.getByRole("complementary", { name: "Deck" }).getByRole("heading", { name: "Legends · 3/3" })).toBeVisible();
  await expect.poll(async () => (await prisma.deck.findFirst({ where: { userId: account.id } }))?.name, { timeout: 10_000 }).toBe("Deck E2E");
  if (isMobile) await page.getByRole("tab", { name: /^Deck/ }).click();
  await expectNoHorizontalScroll(page);
  await snap(page, "f-deck-contenu");
  await page.getByRole("button", { name: "Exporter" }).click();
  await snap(page, "f-deck-export");
  await page.keyboard.press("Escape");
  await ready(page, "/fr/decks");
  await expect(page.getByText("Deck E2E")).toBeVisible();
  await page.getByRole("button", { name: "Dupliquer" }).click();
  await expect.poll(() => prisma.deck.count({ where: { userId: account.id } }), { timeout: 10_000 }).toBe(2);
  for (const left of [1, 0]) {
    await page.getByRole("button", { name: "Supprimer" }).first().click();
    await page.getByRole("button", { name: "Confirmer la suppression" }).click();
    await expect.poll(() => prisma.deck.count({ where: { userId: account.id } }), { timeout: 10_000 }).toBe(left);
    await expect(page.getByRole("button", { name: "Supprimer" })).toHaveCount(left);
  }
  await expect(page.getByText("Aucun deck pour l’instant. Créez-en un pour commencer.")).toBeVisible();
});

test("paramètres : partage du classeur, export, langue, déconnexion", async ({ page, account, browser, baseURL }) => {
  const printing = await prisma.printing.findFirst({ where: { language: "en" } });
  const condition = await prisma.condition.findFirst({ where: { code: "NM" } });
  await prisma.collectionItem.create({ data: { userId: account.id, printingId: printing!.id, conditionId: condition!.id, quantity: 1 } });

  await ready(page, "/fr/parametres");
  await page.getByRole("button", { name: "Créer un lien de partage" }).click();
  const link = page.getByRole("textbox", { name: "Lien de partage" });
  await expect(link).toHaveValue(/\/classeur\//);
  const url = await link.inputValue();

  // Le lien s'ouvre sans compte.
  const guest = await browser.newContext({ ...test.info().project.use, baseURL, extraHTTPHeaders: { "x-forwarded-for": runClientIp(requireRunId()) } });
  try {
    const g = await guest.newPage();
    await g.goto(url);
    await settle(g);
    await expect(g.getByText(account.displayName).first()).toBeVisible();
    await expectNoHorizontalScroll(g);
    await snap(g, "f-classeur-partage");
    await g.getByRole("link", { name: /Cartes/ }).last().click();
    await expect(g).toHaveURL(/\/cartes$/);
    await settle(g);
    await expectNoHorizontalScroll(g);
    await snap(g, "f-classeur-cartes");

    // Exports.
    const csv = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter en CSV" }).click();
    expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
    const json = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter en JSON" }).click();
    expect((await json).suggestedFilename()).toMatch(/\.json$/);

    // Révocation : le lien ne répond plus.
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Révoquer le lien" }).click();
    await expect(page.getByRole("button", { name: "Créer un lien de partage" })).toBeVisible();
    const res = await g.goto(url);
    await settle(g);
    expect(res?.status() === 404 || (await g.getByText(/introuvable|expiré|révoqué/i).count()) > 0).toBeTruthy();
  } finally {
    await guest.close();
  }

  // Langue : passage en anglais puis retour.
  await page.getByRole("combobox", { name: "Langue du site" }).selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await expect(page).toHaveURL(/\/en\//);
  await page.getByRole("combobox", { name: "Site language" }).selectOption("fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paramètres");

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("button", { name: "Se connecter" }).or(page.getByRole("link", { name: /Connexion/i })).first()).toBeVisible();
  await expect.poll(() => prisma.session.count({ where: { userId: account.id } })).toBe(0);
});

test("tournoi : créer, inscrire des joueurs, jouer une ronde, rejoindre par code", async ({ page, account, browser, baseURL }) => {
  page.on("dialog", (d) => void d.accept());
  await ready(page, "/fr/tournois");
  await page.getByRole("textbox", { name: "Nom du tournoi" }).fill("Tournoi E2E");
  await press(page, page.getByRole("button", { name: "Créer", exact: true }));
  await page.waitForURL(/\/tournois\/c/);
  const id = page.url().split("/").pop()!;
  try {
    await expect(page.getByText("Chargement…")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tournoi E2E");
    for (const p of ["Alice", "Bob", "Chloé"]) {
      await page.getByRole("textbox", { name: "Pseudo" }).fill(p);
      await press(page, page.getByRole("button", { name: "Ajouter", exact: true }));
      await expect(page.getByText(p, { exact: true })).toBeVisible();
    }

    // Un joueur rejoint par le code depuis un autre téléphone, sans compte.
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    const guest = await browser.newContext({ ...test.info().project.use, baseURL, extraHTTPHeaders: { "x-forwarded-for": runClientIp(requireRunId()) } });
    try {
      const g = await guest.newPage();
      await ready(g, "/fr/tournois".replace("/tournois", "/t/" + (t as { code: string }).code));
      await snap(g, "f-tournoi-joueur-accueil");
      await g.getByRole("textbox", { name: "Votre pseudo" }).fill("Dave");
      await press(g, g.getByRole("button", { name: /Rejoindre/ }).first());
      await expect(g.getByText("Vous êtes inscrit. En attente de la première ronde.")).toBeVisible();
      await expectNoHorizontalScroll(g);
      await snap(g, "f-tournoi-joueur-inscrit");
      await expect(page.getByText("Dave", { exact: true })).toBeVisible({ timeout: 20_000 });

      await page.getByRole("button", { name: "Ronde", exact: true }).click();
      await page.getByRole("button", { name: "Apparier la ronde 1" }).click();
      await page.getByRole("button", { name: "Démarrer la ronde" }).click();
      await snap(page, "f-tournoi-ronde");
      for (const win of await page.getByRole("button", { name: /^Victoire de/ }).all()) {
        if (await win.isVisible()) await win.click().catch(() => undefined);
      }
      await snap(page, "f-tournoi-resultats");
      await page.getByRole("button", { name: "Classement", exact: true }).click();
      await expectNoHorizontalScroll(page);
      await snap(page, "f-tournoi-classement");
      await g.reload();
      await settle(g);
      await snap(g, "f-tournoi-joueur-ronde");
    } finally {
      await guest.close();
    }
  } finally {
    await prisma.tournament.deleteMany({ where: { id } });
  }
  void account;
});

test("boutique : création avec adresse", async ({ page, account }) => {
  await ready(page, "/fr/compte/boutique");
  await page.getByRole("button", { name: "Créer ma boutique" }).click();
  await page.getByRole("textbox", { name: "Nom de la boutique" }).fill(`Boutique E2E ${account.id.slice(-6)}`);
  await page.getByRole("combobox", { name: "Adresse" }).pressSequentially("10 rue de Rivoli Paris", { delay: 20 });
  await page.getByRole("button", { name: /10 Rue de Rivoli/ }).click();
  await page.getByRole("textbox", { name: "Horaires d'ouverture" }).fill("Mar–Sam 10h–19h");
  try {
    await press(page, page.getByRole("button", { name: "Enregistrer" }));
    await expect.poll(() => prisma.shop.count({ where: { name: { startsWith: "Boutique E2E" } } }), { timeout: 15_000 }).toBe(1);
    await settle(page);
    await expectNoHorizontalScroll(page);
    await snap(page, "f-boutique");
  } finally {
    await prisma.shop.deleteMany({ where: { name: `Boutique E2E ${account.id.slice(-6)}` } });
  }
});

test("barre de navigation : chaque onglet ouvre son écran", async ({ page, account, isMobile }) => {
  void account;
  await ready(page, "/fr");
  // Le badge « N » de next dev (absent en production) recouvre le premier onglet.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const nav = page.getByRole("navigation", { name: "Sections" });
  await expect(nav).toBeVisible();
  // Téléphone : barre d'onglets du bas ; ordinateur : barre de l'en-tête (l'autre est masquée).
  const inHeader = await nav.evaluate((el) => el.closest("header") !== null);
  expect(inHeader, isMobile ? "barre du bas attendue" : "barre de l'en-tête attendue").toBe(!isMobile);
  const links = await nav.getByRole("link").all();
  expect(links.length).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < links.length; i++) {
    const link = nav.getByRole("link").nth(i);
    const href = await link.getAttribute("href");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/\?.*$/, "")}(\\?|$)`));
    await settle(page);
    await expectNoHorizontalScroll(page);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  }
});

test.describe("visiteur", () => {
  test.use({ signedIn: false });

  test("inscription par l'écran puis déconnexion", async ({ page, account }) => {
    void account;
    const email = `e2e.${requireRunId()}.signup-${test.info().project.name}@example.com`;
    try {
      await ready(page, "/fr/connexion");
      await page.getByRole("tab", { name: "Créer un compte" }).click();
      await snap(page, "f-inscription");
      const fields = page.locator("main input:visible");
      console.log("champs inscription", await fields.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name || (e as HTMLInputElement).type)));
      await page.getByLabel(/Nom affiché|Pseudo/).fill("E2E Signup");
      await page.getByLabel("Adresse e-mail").fill(email);
      await page.getByLabel("Mot de passe", { exact: true }).fill("e2e-motdepasse-123");
      const confirm = page.getByLabel(/Confirmer/);
      if (await confirm.count()) await confirm.fill("e2e-motdepasse-123");
      for (const box of await page.locator("main input[type=checkbox]:visible").all()) await box.check();
      await press(page, page.locator("main form button[type=submit]").first());
      await expect(page).toHaveURL(/\/fr\/?$/, { timeout: 20_000 });
      await expect(page.getByText("Cartes uniques", { exact: true })).toBeVisible();
      await snap(page, "f-inscrit");
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("accueil : changer de langue, catalogue, fiche carte", async ({ page }) => {
    await ready(page, "/fr");
    await page.getByRole("button", { name: "Langue : Français" }).click();
    await snap(page, "f-menu-langue");
    await page.getByRole("link", { name: /English|EN/ }).or(page.getByRole("menuitem", { name: /English/ })).or(page.getByRole("option", { name: /English/ })).first().click();
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await ready(page, "/fr/cartes");
    await page.getByRole("link", { name: /Unités/ }).first().click();
    await settle(page);
    await page.locator("main a[href*='/cartes/']").first().click();
    await expect(page).toHaveURL(/\/cartes\/[^/]+$/);
    await settle(page);
    await expectNoHorizontalScroll(page);
    await snap(page, "f-fiche-publique");
  });
});
