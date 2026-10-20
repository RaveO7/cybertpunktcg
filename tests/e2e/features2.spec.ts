import { randomBytes } from "node:crypto";
import type { Browser, Locator, Page } from "@playwright/test";
import { createSession, registerAccount, SESSION_COOKIE } from "@/lib/auth";
import { CSV_HEADERS } from "@/lib/collection-csv";
import { prisma } from "@/lib/prisma";
import { requireRunId, runClientIp, runEmailPrefix } from "./setup/paths";
import { expect, expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

/**
 * Seconde série de parcours : import CSV, decks en texte, portefeuille, préférences, mauvais mot de
 * passe, validation d'une boutique par un admin, tournoi public, invitation et QR personnel.
 * Les comptes supplémentaires suivent le préfixe du run (filet du teardown) et sont supprimés ici.
 */

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

/** Autre téléphone : contexte neuf, connecté au compte donné (ou visiteur). */
async function phone(browser: Browser, baseURL: string | undefined, userId?: string) {
  const ctx = await browser.newContext({
    ...test.info().project.use,
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": runClientIp(requireRunId()) },
  });
  if (userId) {
    const { token, expiresAt } = await createSession(userId);
    await ctx.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL, httpOnly: true, sameSite: "Lax", expires: Math.floor(expiresAt.getTime() / 1000) }]);
  }
  return ctx;
}

async function extraAccount(label: string) {
  const email = `${runEmailPrefix(requireRunId())}${label}-${test.info().project.name}-${randomBytes(3).toString("hex")}@example.com`;
  const user = await registerAccount({ email, password: `e2e-${randomBytes(6).toString("hex")}`, displayName: `E2E ${label}` });
  return user;
}

async function englishPrintings(n: number) {
  return prisma.printing.findMany({ where: { language: "en", set: { code: { not: { startsWith: "sealed" } } } }, take: n, orderBy: { id: "asc" } });
}

test("import CSV de la collection", async ({ page, account }) => {
  const [a, b] = await englishPrintings(2);
  const row = (p: typeof a, q: number) =>
    CSV_HEADERS.map((h) => ({ quantity: String(q), condition: "NM", printing_id: p.id, language: "en", purchase_price: "1.50", purchase_currency: "EUR" } as Record<string, string>)[h] ?? "").join(",");
  const csv = [CSV_HEADERS.join(","), row(a, 2), row(b, 1)].join("\n");

  await ready(page, "/fr/parametres");
  await page.locator("input[type=file]").setInputFiles({ name: "collection.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.waitForTimeout(800);
  await snap(page, "g-import-apercu");
  // Aperçu puis confirmation éventuelle.
  const confirm = page.getByRole("button", { name: /Importer|Confirmer|Ajouter/ }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect
    .poll(() => prisma.collectionItem.aggregate({ where: { userId: account.id }, _sum: { quantity: true } }).then((r) => r._sum.quantity), { timeout: 15_000 })
    .toBe(3);
  await snap(page, "g-import-fait");
});

test("deck : import et export d'une liste texte", async ({ page, account, isMobile }) => {
  await ready(page, "/fr/decks");
  await page.getByRole("button", { name: "Nouveau deck" }).click();
  await page.waitForURL(/deck=/);
  await settle(page);
  await page.getByRole("button", { name: "Importer" }).click();
  await page.getByRole("region", { name: "Importer une liste" }).getByRole("textbox").fill("1 V: Streetkid\n3 Japantown Jonin");
  await press(page, page.getByRole("button", { name: /^Remplacer le deck/ }));
  // Téléphone : l'onglet « Deck N » compte les cartes ; ordinateur (lg:) : le deck est une colonne, sans onglets.
  const expectImported = async () => {
    if (isMobile) return expect(page.getByRole("tab", { name: "Deck 4" })).toBeVisible();
    const deck = page.getByRole("complementary", { name: "Deck" });
    await expect(deck.getByRole("heading", { name: "Legends · 1/3" })).toBeVisible();
    await expect(deck.getByRole("button", { name: "Voir Japantown Jonin" })).toBeVisible();
  };
  await expectImported();
  // Enregistré côté serveur (envoi différé de 600 ms) : le compte est toujours de 4 cartes après rechargement.
  await expect
    .poll(() => prisma.deckCard.aggregate({ where: { deck: { userId: account.id } }, _sum: { quantity: true } }).then((r) => r._sum.quantity), { timeout: 15_000 })
    .toBe(4);
  await page.reload();
  await settle(page);
  await expectImported();
  void account;
  await page.getByRole("button", { name: "Exporter" }).click();
  await expect(page.getByText(/Japantown Jonin/).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snap(page, "g-deck-export");
});

test("portefeuille avec des prix réels", async ({ page, account, isMobile }) => {
  // Impression qui a un historique de prix dans le catalogue local (lecture seule).
  const snapshot = await prisma.priceSnapshot.findFirst({ orderBy: { id: "desc" }, select: { printingId: true } }).catch(() => null);
  const printingId = (snapshot as { printingId?: string } | null)?.printingId;
  test.skip(!printingId, "Aucun historique de prix local.");
  const condition = await prisma.condition.findFirstOrThrow({ where: { code: "NM" } });
  await prisma.collectionItem.create({ data: { userId: account.id, printingId: printingId!, conditionId: condition.id, quantity: 2, purchasePrice: 0.05, purchaseCurrency: "EUR" } });

  await ready(page, "/fr/investissement");
  await expect(page.getByText("1 / 1").or(page.getByText("2 / 2")).first()).toBeVisible();
  for (const d of ["1 jour", "1 semaine", "1 mois", "1 an", "Total"]) {
    await page.getByRole("button", { name: d, exact: true }).click();
    await expect(page.getByRole("button", { name: d, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await expectNoHorizontalScroll(page);
  await snap(page, "g-portefeuille");
  // Téléphone : filtres repliés derrière un bouton ; ordinateur (md:) : toujours affichés.
  if (isMobile) await page.getByRole("button", { name: "Filtres", exact: true }).click();
  else await expect(page.getByRole("button", { name: "Filtres", exact: true })).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Extension" })).toBeVisible();
  await snap(page, "g-portefeuille-filtres");
});

test("préférences : tri par défaut et filtres du catalogue", async ({ page, account, isMobile }) => {
  void account;
  await ready(page, "/fr/parametres");
  await page.getByRole("combobox", { name: "Tri par défaut" }).selectOption({ label: "Nom Z–A" });
  await ready(page, "/fr/cards");
  await expect(page.getByRole("combobox", { name: "Tri" })).toHaveValue(/name/i);
  const first = await page.locator("main article").first().innerText();
  console.log("première carte en Z–A :", first.split("\n")[0]);
  expect(first.split("\n")[0].localeCompare("M")).toBeGreaterThan(0);
  const filtersTitle = page.getByRole("heading", { name: "Filtres", level: 2 });
  if (isMobile) {
    // Téléphone : les filtres sont dans un tiroir ouvert par le bouton.
    await page.getByRole("button", { name: "Filtres", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Filtres" })).toBeVisible();
  } else {
    // Ordinateur : les filtres sont une colonne déjà affichée, sans bouton ni tiroir.
    await expect(page.getByRole("button", { name: "Filtres", exact: true })).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Filtres" })).toHaveCount(0);
  }
  await expect(filtersTitle).toBeVisible();
  await snap(page, "g-filtres");
  await expectNoHorizontalScroll(page);
  await ready(page, "/fr/parametres");
  await page.getByRole("button", { name: "Réinitialiser les préférences" }).click();
  await expect(page.getByRole("combobox", { name: "Tri par défaut" })).toHaveValue(/number/i);
});

test.describe("visiteur", () => {
  test.use({ signedIn: false });
  test("liste de souhaits désactivée : 404 directe, sans écran de connexion", async ({ page, account }) => {
    test.skip(process.env.NEXT_PUBLIC_WISHLIST_ENABLED === "1", "liste de souhaits affichée pour ce run (playwright.config.ts)");
    void account;
    await ready(page, "/fr/souhaits");
    await expect(page.getByText("Page introuvable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toHaveCount(0);
  });

  test("connexion avec un mauvais mot de passe", async ({ page, account }) => {
    await ready(page, "/fr/connexion");
    await page.getByLabel("Adresse e-mail").fill(account.email);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await press(page, page.getByRole("button", { name: "Se connecter" }).last());
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
    console.log("message :", await page.getByRole("alert").filter({ hasText: /./ }).first().innerText());
    await expect(page).toHaveURL(/connexion/);
    await snap(page, "g-mauvais-mdp");
  });
});

test("boutique validée par un admin puis visible publiquement", async ({ page, account, browser, baseURL }) => {
  const name = `Boutique E2E ${account.id.slice(-6)}`;
  const admin = await extraAccount("admin");
  await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
  try {
    await ready(page, "/fr/compte/boutique");
    await page.getByRole("button", { name: "Créer ma boutique" }).click();
    await page.getByRole("textbox", { name: "Nom de la boutique" }).fill(name);
    await page.getByRole("combobox", { name: "Adresse" }).pressSequentially("10 rue de Rivoli Paris", { delay: 20 });
    await page.getByRole("button", { name: /10 Rue de Rivoli/ }).click();
    await press(page, page.getByRole("button", { name: "Enregistrer" }));
    await expect.poll(() => prisma.shop.findFirst({ where: { name } }).then((s) => s?.status), { timeout: 15_000 }).toBe("pending");
    const shop = (await prisma.shop.findFirst({ where: { name } }))!;

    const adminCtx = await phone(browser, baseURL, admin.id);
    try {
      const a = await adminCtx.newPage();
      await ready(a, "/fr/admin/boutiques");
      await expect(a.getByText(name)).toBeVisible();
      await snap(a, "g-admin-attente");
      const card = a.locator("li, article, section").filter({ hasText: name }).last();
      await card.getByRole("button", { name: /Valider|Vérifier|Approuver/ }).first().click();
      await expect.poll(() => prisma.shop.findUnique({ where: { id: shop.id } }).then((s) => s?.status), { timeout: 15_000 }).not.toBe("pending");
      console.log("statut après validation :", (await prisma.shop.findUnique({ where: { id: shop.id } }))?.status);
    } finally {
      await adminCtx.close();
    }

    const guestCtx = await phone(browser, baseURL);
    try {
      const g = await guestCtx.newPage();
      const res = await g.goto(`/fr/boutiques/${shop.slug}`);
      await settle(g);
      expect(res?.status()).toBe(200);
      await expect(g.getByRole("heading", { level: 1 })).toContainText(name);
      await expectNoHorizontalScroll(g);
      await snap(g, "g-boutique-publique");
    } finally {
      await guestCtx.close();
    }
  } finally {
    await prisma.shop.deleteMany({ where: { name } });
    await prisma.user.deleteMany({ where: { id: admin.id } });
  }
});

test("tournoi public, inscription publique, co-organisateur et QR personnel", async ({ page, account, browser, baseURL }) => {
  page.on("dialog", (d) => void d.accept());
  const other = await extraAccount("joueur");
  const tokens: Record<string, string> = {};
  page.on("response", async (r) => {
    if (!r.url().includes("/actions") || r.request().method() !== "POST") return;
    const type = JSON.parse(r.request().postData() ?? "{}").type as string;
    const body = (await r.json().catch(() => null)) as { data?: { token?: string } } | null;
    if (body?.data?.token) tokens[type] = body.data.token;
  });
  await ready(page, "/fr/tournois");
  await page.getByRole("textbox", { name: "Nom du tournoi" }).fill("Open E2E");
  await press(page, page.getByRole("button", { name: "Créer", exact: true }));
  await page.waitForURL(/\/tournois\/c/);
  const id = page.url().split("/").pop()!;
  try {
    await expect(page.getByText("Chargement…")).toHaveCount(0, { timeout: 30_000 });
    // Joueur sans appli + QR personnel.
    await page.getByRole("textbox", { name: "Pseudo" }).fill("Alice");
    await press(page, page.getByRole("button", { name: "Ajouter", exact: true }));
    await page.getByText("Alice", { exact: true }).click();
    await page.getByRole("button", { name: "QR personnel" }).click();
    await expect(page.getByRole("img", { name: "QR personnel" })).toBeVisible();
    await expect.poll(() => tokens.issueClaim).toBeTruthy();

    // Publication : date à venir et lieu.
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    const start = new Date(Date.now() + 7 * 864e5);
    const local = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}T18:30`;
    await page.getByRole("textbox", { name: "Date et heure de début" }).fill(local);
    await page.getByRole("combobox", { name: "Adresse", exact: true }).pressSequentially("10 rue de Rivoli Paris", { delay: 20 });
    await page.getByRole("button", { name: /10 Rue de Rivoli/ }).click();
    await page.getByRole("textbox", { name: /^Présentation/ }).fill("Tournoi de test e2e.");
    await press(page, page.getByRole("button", { name: "Enregistrer" }).last());
    await page.waitForTimeout(800);
    await press(page, page.getByRole("button", { name: "Publier dans l'annuaire" }));
    await expect.poll(() => prisma.tournament.findUnique({ where: { id } }).then((t) => t?.visibility), { timeout: 15_000 }).toBe("public");
    await snap(page, "g-tournoi-publie");
    await page.getByRole("button", { name: "Inviter un co-organisateur" }).click();
    await expect.poll(() => tokens.inviteOrganizer).toBeTruthy();

    const ctx = await phone(browser, baseURL, other.id);
    try {
      const p = await ctx.newPage();
      // Annuaire public puis fiche.
      await ready(p, "/fr/tournois/publics");
      await snap(p, "g-annuaire");
      const res = await p.goto(`/fr/tournois/publics/${id}`);
      await settle(p);
      expect(res?.status()).toBe(200);
      await expect(p.getByRole("heading", { level: 1 })).toContainText("Open E2E");
      await expectNoHorizontalScroll(p);
      await snap(p, "g-tournoi-fiche");
      const ics = await p.request.get(`/api/tournaments/public/${id}/calendar`);
      expect(ics.status()).toBe(200);
      expect(await ics.text()).toContain("BEGIN:VCALENDAR");
      await p.getByRole("button", { name: /inscri|Rejoindre|Participer/i }).first().click();
      await expect.poll(() => prisma.tournamentPlayer.count({ where: { tournamentId: id, userId: other.id } }), { timeout: 15_000 }).toBe(1);
      await snap(p, "g-tournoi-inscrit");

      // Invitation co-organisateur.
      await ready(p, `/fr/tournois/invitation/${tokens.inviteOrganizer}`);
      await p.getByRole("button", { name: "Accepter l’invitation" }).click();
      await expect.poll(() => prisma.tournamentOrganizer.count({ where: { tournamentId: id } }), { timeout: 15_000 }).toBe(2);
      await p.waitForURL(new RegExp(`/tournois/${id}`), { timeout: 15_000 }).catch(() => undefined);
      await snap(p, "g-coorga");
      // Invitation déjà acceptée : message dès l'ouverture, sans bouton.
      await ready(p, `/fr/tournois/invitation/${tokens.inviteOrganizer}`);
      await expect(p.getByRole("alert").filter({ hasText: /./ })).toHaveText("Invitation invalide ou expirée.");
      await expect(p.getByRole("button", { name: "Accepter l’invitation" })).toHaveCount(0);
    } finally {
      await ctx.close();
    }

    // QR personnel scanné par le téléphone d'Alice (sans compte).
    const alice = await phone(browser, baseURL);
    try {
      const a = await alice.newPage();
      await ready(a, `/fr/t/claim/${tokens.issueClaim}`);
      await a.getByRole("button", { name: "Lier ce téléphone" }).click();
      await a.waitForURL(/\/t\/[A-Z0-9]{6}/, { timeout: 15_000 });
      await settle(a);
      await expect(a.getByText("Alice").first()).toBeVisible();
      await snap(a, "g-qr-perso-lie");
      // QR déjà utilisé, puis lien mal formé : message dès l'ouverture, sans bouton.
      for (const claim of [tokens.issueClaim, "jeton-invalide-e2e"]) {
        await ready(a, `/fr/t/claim/${claim}`);
        await expect(a.getByRole("alert").filter({ hasText: /./ })).toHaveText("QR code invalide ou déjà utilisé : demandez-en un nouveau à l'organisateur.");
        await expect(a.getByRole("button", { name: "Lier ce téléphone" })).toHaveCount(0);
      }
      await snap(a, "g-qr-perso-invalide");
    } finally {
      await alice.close();
    }
  } finally {
    await prisma.tournament.deleteMany({ where: { id } });
    // Compteur de publication rangé par compte (pas par IP) : le teardown du run ne le voit pas.
    await prisma.rateLimit.deleteMany({ where: { key: `tournament-publish:${account.id}` } });
    await prisma.user.deleteMany({ where: { id: other.id } });
  }
});
