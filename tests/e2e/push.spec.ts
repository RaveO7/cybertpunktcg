import type { BrowserContext, Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { expect, settle, test } from "./fixtures";

/**
 * Notifications d'alerte de prix : option des réglages, proposition dans la liste de souhaits et
 * désabonnement à la déconnexion. Le service worker est bloqué en test et Chromium n'a pas de service
 * push : l'abonnement du navigateur est simulé (endpoint en push.example.com), l'autorisation vient du
 * contexte Playwright. Les abonnements suivent le compte de test (suppression en cascade).
 */

/** Abonnement Web Push simulé : `getRegistration()` renvoie un enregistrement avec un PushManager factice. */
async function fakePushManager(context: BrowserContext) {
  await context.addInitScript(() => {
    // L'abonnement survit aux rechargements de la page, comme celui d'un vrai navigateur.
    const STORE = "e2e-push-endpoint";
    const keys = {
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
      auth: "tBHItJI5svbpez7KI4CCXg",
    };
    const wrap = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, expirationTime: null, keys }),
      unsubscribe: async () => {
        sessionStorage.removeItem(STORE);
        return true;
      },
    });
    const registration = {
      pushManager: {
        getSubscription: async () => {
          const endpoint = sessionStorage.getItem(STORE);
          return endpoint ? wrap(endpoint) : null;
        },
        subscribe: async () => {
          const endpoint = `https://push.example.com/e2e/${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem(STORE, endpoint);
          return wrap(endpoint);
        },
      },
    };
    const w = window as unknown as { PushManager?: unknown };
    if (!("PushManager" in window)) w.PushManager = function PushManager() {};
    navigator.serviceWorker.getRegistration = (async () => registration) as never;
  });
}

const subscriptions = (userId: string) => prisma.pushSubscription.count({ where: { userId } });

async function open(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
}

// L'option n'existe que si la liste de souhaits est affichée (WISHLIST_ENABLED, voir playwright.config.ts).
test.skip(process.env.NEXT_PUBLIC_WISHLIST_ENABLED !== "1", "liste de souhaits masquée pour ce run");

test("autorisation accordée : proposition dans la liste de souhaits, puis désabonnement à la déconnexion", async ({
  page,
  context,
  account,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== "chromium", "autorisation des notifications accordée via le contexte : Chromium seulement");
  await context.grantPermissions(["notifications"], { origin: baseURL });
  await fakePushManager(context);
  const printing = await prisma.printing.findFirstOrThrow({ where: { isActive: true, language: "en" }, orderBy: { id: "asc" } });
  await prisma.wishlistItem.create({ data: { userId: account.id, printingId: printing.id, targetPrice: "0.01" } });

  await open(page, "/fr/souhaits");
  const prompt = page.getByRole("region", { name: "Notifications d’alerte de prix" });
  await expect(prompt).toContainText("Être prévenu par notification");
  await prompt.getByRole("button", { name: "Activer les notifications" }).click();
  await expect(prompt.getByRole("status")).toHaveText("Notifications activées sur cet appareil.");
  await expect.poll(() => subscriptions(account.id)).toBe(1);
  const row = await prisma.pushSubscription.findFirstOrThrow({ where: { userId: account.id } });
  expect(row.locale).toBe("fr");

  await open(page, "/fr/parametres");
  await expect(page.getByRole("button", { name: "Désactiver sur cet appareil" })).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect.poll(() => subscriptions(account.id)).toBe(0);
});

test("réglages : activer puis désactiver ; autorisation non accordée : rien n'est enregistré", async ({ page, context, account, browserName, baseURL }) => {
  test.skip(browserName !== "chromium", "autorisation des notifications via le contexte : Chromium seulement");
  await fakePushManager(context);

  // Contexte sans autorisation : Chromium piloté ferme la demande sans l'accorder.
  await open(page, "/fr/parametres");
  const enable = page.getByRole("button", { name: "Activer sur cet appareil" });
  await enable.click();
  await expect(enable).toBeEnabled();
  expect(await subscriptions(account.id)).toBe(0);

  await context.grantPermissions(["notifications"], { origin: baseURL });
  await open(page, "/fr/parametres");
  await page.getByRole("button", { name: "Activer sur cet appareil" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notifications activées sur cet appareil." })).toBeVisible();
  await expect.poll(() => subscriptions(account.id)).toBe(1);

  await page.getByRole("button", { name: "Désactiver sur cet appareil" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notifications désactivées sur cet appareil." })).toBeVisible();
  await expect.poll(() => subscriptions(account.id)).toBe(0);
});

test("autorisation refusée : l'option explique comment réautoriser, rien n'est enregistré", async ({ page, context, account, browserName }) => {
  test.skip(browserName !== "chromium", "abonnement simulé sur Chromium seulement");
  await fakePushManager(context);
  // Playwright sait accorder une autorisation, pas la refuser : la réponse « bloquer » est simulée.
  await context.addInitScript(() => {
    Notification.requestPermission = (async () => "denied") as never;
  });
  await open(page, "/fr/parametres");
  await page.getByRole("button", { name: "Activer sur cet appareil" }).click();
  await expect(page.getByText("Les notifications sont bloquées pour ce site.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activer sur cet appareil" })).toBeDisabled();
  expect(await subscriptions(account.id)).toBe(0);
});

test("iPhone hors de l'app installée : l'option explique comment l'installer", async ({ page, account }) => {
  test.skip(test.info().project.name !== "iphone", "comportement propre à iOS");
  expect(account.id).toBeTruthy();
  await open(page, "/fr/parametres");
  await expect(page.getByText("Sur iPhone et iPad, ajoutez d’abord l’application à l’écran d’accueil")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activer sur cet appareil" })).toBeDisabled();
});
