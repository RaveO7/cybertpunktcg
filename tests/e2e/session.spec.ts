import { prisma } from "@/lib/prisma";
import { expect, settle, snap, test } from "./fixtures";
import { requireRunId, runClientIp } from "./setup/paths";

/** Tableau de bord connecté : la case « Cartes uniques » n'existe que pour un compte. */
const dashboard = (page: import("@playwright/test").Page) => page.getByText("Cartes uniques", { exact: true });
const passwordField = (page: import("@playwright/test").Page) => page.locator('input[name="password"]');

// La connexion par l'écran incrémente le compteur `login:e2e-<runId>` : supprimé après chaque test.
test.afterEach(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { endsWith: `:${runClientIp(requireRunId())}` } } });
});

test.describe("connexion par l'écran", () => {
  test.use({ signedIn: false });

  test("le formulaire de connexion est dans le HTML du serveur (affiché sans attendre le JS)", async ({ request }) => {
    const html = await (await request.get("/fr/connexion")).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).toContain('name="password"');
    expect(body).toContain("La collection est enregistrée sur votre compte");
  });

  test("titre et intro des decks sont dans le HTML du serveur (LCP sans attendre le JS ni la session)", async ({ request }) => {
    const html = await (await request.get("/fr/decks")).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).toContain("Construisez vos decks");
  });

  test("l'écran des tournois est dans le HTML du serveur (affiché pendant la vérification de session)", async ({ request }) => {
    const html = await (await request.get("/fr/tournois")).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).toContain("Rejoindre un tournoi");
  });

  test("l'écran des paramètres est dans le HTML du serveur (affiché pendant la vérification de session)", async ({ request }) => {
    const html = await (await request.get("/fr/parametres")).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).toContain("Langue du site");
  });

  test("titre et intro du tableau de bord sont dans le HTML du serveur", async ({ request }) => {
    const html = await (await request.get("/fr/tableau-de-bord")).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).toContain("Suivez votre collection extension par extension");
  });

  test("titre et intro de l'investissement sont dans le HTML du serveur", async ({ request }) => {
    const html = await (await request.get("/fr/investissement")).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).toContain("Suivez la valeur de votre collection au prix Cardmarket");
  });

  test("la session tient après rechargement et dans un nouvel onglet", async ({ page, context, account }) => {
    await page.goto("/fr/connexion");
    await page.getByRole("tab", { name: "Se connecter" }).click();
    await page.locator('input[name="email"]').fill(account.email);
    await passwordField(page).fill(account.password);
    await snap(page, "session-connexion");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/fr\/?$/);
    await expect(dashboard(page)).toBeVisible();
    await snap(page, "session-tableau-de-bord");

    await page.reload();
    await expect(dashboard(page)).toBeVisible();
    await expect(passwordField(page)).toHaveCount(0);

    const tab = await context.newPage();
    await tab.goto("/fr");
    await expect(dashboard(tab)).toBeVisible();
    await expect(passwordField(tab)).toHaveCount(0);
    await tab.close();
  });

  test("un visiteur n'interroge pas sa session sur les pages publiques", async ({ page }) => {
    const collectionCalls: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/collection") collectionCalls.push(page.url());
    });

    await page.goto("/fr/cartes");
    const cardHref = await page.locator('a[href^="/fr/cartes/"]').first().getAttribute("href");
    for (const path of ["/fr", "/fr/cartes", cardHref ?? "", "/fr/connexion", "/fr/cgu"]) {
      expect(path).not.toBe("");
      await page.goto(path);
      await settle(page);
    }
    expect(collectionCalls).toEqual([]);

    // Page réservée aux comptes : la session y est vérifiée (cookie absent → écran de connexion).
    await page.goto("/fr/decks");
    await expect(passwordField(page)).toBeVisible();
    expect(collectionCalls).toHaveLength(1);
  });
});

test("une session vérifiée au chargement ne fait pas redemander la page", async ({ page, account }) => {
  void account;
  // Cookie seul, rien de mémorisé sur l'appareil : la vérification confirme la session avec laquelle le serveur
  // a rendu la page. Un router.refresh la redemanderait (requête RSC hors préchargement) et la rendrait deux fois.
  const pageReloads: string[] = [];
  page.on("request", (request) => {
    const headers = request.headers();
    if (headers.rsc === "1" && !headers["next-router-prefetch"] && new URL(request.url()).pathname === "/fr/decks") {
      pageReloads.push(request.url());
    }
  });
  await page.goto("/fr/decks");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await settle(page);
  expect(pageReloads).toEqual([]);
});

test("cookie de session sans session mémorisée : collection et catalogue partent depuis le <head>", async ({ page, account }) => {
  void account;
  // Le script du <head> range ses requêtes dans window.__cptcgBoot (repris ensuite par CollectionProvider) :
  // on note leur lancement au moment où il les range.
  await page.addInitScript(() => {
    let boot: unknown;
    Object.defineProperty(window, "__cptcgBoot", {
      configurable: true,
      get: () => boot,
      set: (value) => {
        boot = value;
        (window as unknown as { bootStarted: boolean }).bootStarted = true;
      },
    });
  });
  // Rien de mémorisé sur l'appareil : seul l'indicateur posé par le proxy annonce la session.
  await page.goto("/fr/cards");
  await expect(page.locator("[data-card-id]").first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { bootStarted?: boolean }).bootStarted)).toBe(true);
  expect(await page.evaluate(() => document.cookie)).toContain("cptcg_signed=1");
});

test("une session supprimée en base renvoie à l'écran de connexion", async ({ page, account }) => {
  await page.goto("/fr");
  await expect(dashboard(page)).toBeVisible();
  await settle(page);

  await prisma.session.deleteMany({ where: { userId: account.id } });
  await page.reload();
  await expect(passwordField(page)).toBeVisible();
  await expect(dashboard(page)).toHaveCount(0);
  await snap(page, "session-expiree");
});
