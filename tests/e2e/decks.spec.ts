import { prisma } from "@/lib/prisma";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";
import { requireRunId, runClientIp } from "./setup/paths";

test("un deck créé par l'interface apparaît dans la liste", async ({ page, account }) => {
  void account;
  await page.goto("/fr/decks");
  await expect(page.getByRole("heading", { name: "Decks" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Le deck est créé tout de suite et ouvert dans l'éditeur ; il part avec le compte.
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await expect(page).toHaveURL(/[?&]deck=/);
  const deckId = new URL(page.url()).searchParams.get("deck");
  expect(deckId).toBeTruthy();
  await expectNoHorizontalScroll(page);
  await snap(page, "decks-editeur");

  await page.getByRole("link", { name: "Mes decks" }).click();
  await expect(page.locator(`a[href*="deck=${deckId}"]`)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snap(page, "decks-liste");
});

test("une modification de deck n'est pas perdue si l'on quitte la page aussitôt", async ({ page, account }) => {
  await page.goto("/fr/decks");
  await settle(page);
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await page.waitForURL(/deck=/);
  await settle(page);
  await page.getByRole("button", { name: "Ajouter un exemplaire de V: Streetkid" }).click();
  // Départ avant la fin du délai de 600 ms : seul l'envoi au « pagehide » peut l'enregistrer.
  await page.goto("about:blank");
  await expect
    .poll(() => prisma.deckCard.count({ where: { deck: { userId: account.id } } }), { timeout: 10_000 })
    .toBe(1);
});

/** Trois Legends ayant au moins un tirage actif (un exemplaire de chacune par deck). */
async function legendCards() {
  const cards = await prisma.card.findMany({
    where: { cardType: "Legend", printings: { some: { isActive: true } } },
    select: { id: true, printings: { where: { isActive: true }, select: { id: true }, take: 1 } },
    orderBy: { id: "asc" },
    take: 3,
  });
  expect(cards).toHaveLength(3);
  return cards;
}

test("les cartes manquantes s'ajoutent à la liste de souhaits en une fois", async ({ page, account }) => {
  const cards = await legendCards();
  const deck = await prisma.deck.create({
    data: { userId: account.id, name: "Deck manquantes", cards: { create: cards.map((card) => ({ cardId: card.id, quantity: 1 })) } },
  });
  await page.goto(`/fr/decks?deck=${deck.id}`);
  await settle(page);
  const button = page.getByRole("button", { name: "Ajouter les manquantes à ma liste de souhaits" });

  // Échec réseau : message d'erreur, aucune ligne ajoutée.
  await page.route("**/api/wishlist/bulk", (route) => route.abort());
  await button.click();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
  expect(await prisma.wishlistItem.count({ where: { userId: account.id } })).toBe(0);
  await page.unroute("**/api/wishlist/bulk");

  await button.click();
  await expect(page.getByRole("status").filter({ hasText: "3 ajoutées, 0 déjà présente" })).toBeVisible();
  expect(await prisma.wishlistItem.count({ where: { userId: account.id } })).toBe(3);

  // Relancer conserve les lignes existantes et leur prix cible.
  const kept = await prisma.wishlistItem.findFirstOrThrow({ where: { userId: account.id } });
  await prisma.wishlistItem.update({ where: { id: kept.id }, data: { targetPrice: "1.50", notes: "garder" } });
  await button.click();
  await expect(page.getByRole("status").filter({ hasText: "0 ajoutée, 3 déjà présentes" })).toBeVisible();
  const after = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: kept.id } });
  expect([after.targetPrice?.toString(), after.notes]).toEqual(["1.5", "garder"]);
});

test("la liste des decks indique « Complet » ou le nombre de manquantes", async ({ page, account }) => {
  const cards = await legendCards();
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  await prisma.collectionItem.create({
    data: { userId: account.id, printingId: cards[0].printings[0].id, conditionId: condition.id, quantity: 1 },
  });
  const complete = await prisma.deck.create({
    data: { userId: account.id, name: "Deck complet", cards: { create: [{ cardId: cards[0].id, quantity: 1 }] } },
  });
  const partial = await prisma.deck.create({
    data: { userId: account.id, name: "Deck partiel", cards: { create: cards.map((card) => ({ cardId: card.id, quantity: 1 })) } },
  });
  await page.goto("/fr/decks");
  await settle(page);
  const summary = (id: string) => page.getByRole("listitem").filter({ has: page.locator(`a[href*="deck=${id}"]`) });
  await expect(summary(complete.id).getByText("Complet", { exact: true })).toBeVisible();
  await expect(summary(partial.id).getByText("2 manquantes", { exact: true })).toBeVisible();
});

test("un deck partagé se lit sans compte, se copie dans ses decks et se révoque", async ({ page, account, browser, baseURL }) => {
  const cards = await legendCards();
  const secretNote = `note-privee-${account.id}`;
  const deck = await prisma.deck.create({
    data: {
      userId: account.id,
      name: "Deck partagé E2E",
      notes: secretNote,
      cards: { create: cards.map((card) => ({ cardId: card.id, quantity: 1 })) },
    },
  });
  await page.goto(`/fr/decks?deck=${deck.id}`);
  await settle(page);
  await page.getByRole("button", { name: "Partager" }).click();
  await page.getByRole("button", { name: "Créer le lien" }).click();
  const address = page.getByLabel("Adresse du lien");
  await expect(address).toHaveValue(/\/fr\/deck\/[A-Za-z0-9_-]{32}$/);
  const sharedPath = new URL(await address.inputValue()).pathname;
  expect(sharedPath).not.toContain(deck.id);

  // Visiteur sans compte : la liste, la validité et le propriétaire, sans écran de connexion ni donnée privée.
  const visitor = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": runClientIp(requireRunId()) },
  });
  try {
    const guest = await visitor.newPage();
    const response = await guest.goto(sharedPath);
    expect(response?.status()).toBe(200);
    await expect(guest.getByRole("heading", { name: "Deck partagé E2E" })).toBeVisible();
    await expect(guest.getByText(`Deck de ${account.displayName}`)).toBeVisible();
    await expect(guest.getByText("3 cartes", { exact: true })).toBeVisible();
    await expect(guest.getByRole("link", { name: "Se connecter pour copier ce deck" })).toBeVisible();
    const html = await guest.content();
    for (const secret of [secretNote, account.email, account.id, deck.id]) expect(html).not.toContain(secret);
    await expectNoHorizontalScroll(guest);
    await snap(guest, "deck-partage");

    // Compte connecté : « Copier dans mes decks » crée un deck indépendant avec les mêmes cartes.
    await page.goto(sharedPath);
    await page.getByRole("button", { name: "Copier dans mes decks" }).click();
    await expect(page).toHaveURL(/\/fr\/decks\?deck=/);
    const copyId = new URL(page.url()).searchParams.get("deck");
    expect(copyId).toBeTruthy();
    expect(copyId).not.toBe(deck.id);
    const copy = await prisma.deck.findUniqueOrThrow({ where: { id: copyId! }, include: { cards: true } });
    expect(copy.userId).toBe(account.id);
    expect(copy.name).toBe("Deck partagé E2E");
    expect(copy.notes).toBeNull();
    expect(copy.cards.map((card) => card.cardId).sort()).toEqual(cards.map((card) => card.id).sort());

    // Révocation : l'ancienne adresse répond 404.
    await page.goto(`/fr/decks?deck=${deck.id}`);
    await settle(page);
    await page.getByRole("button", { name: "Partager" }).click();
    await page.getByRole("button", { name: "Révoquer" }).click();
    await expect(page.getByRole("button", { name: "Créer le lien" })).toBeVisible();
    expect((await guest.goto(sharedPath))?.status()).toBe(404);
  } finally {
    await visitor.close();
  }
});
