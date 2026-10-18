import { randomBytes } from "node:crypto";
import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { createSession, registerAccount, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRunId, runClientIp, runEmailPrefix, SCREENSHOTS_DIR } from "./setup/paths";

export type TestAccount = {
  id: string;
  email: string;
  password: string;
  displayName: string;
};

type Fixtures = {
  /** Pose le cookie de session du compte dans le navigateur (false : compte créé, non connecté). */
  signedIn: boolean;
  /** Compte `@example.com` créé en base pour ce test et supprimé à la fin, même en cas d'échec. */
  account: TestAccount;
};

export const test = base.extend<Fixtures>({
  signedIn: [true, { option: true }],

  // Toutes les requêtes du navigateur portent l'IP fictive du run : les compteurs du limiteur créés
  // pendant les tests ont leur propre clé (supprimée à la fin), jamais celle de l'utilisateur.
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": runClientIp(requireRunId()) });
  },

  account: async ({ context, baseURL, signedIn }, provide, testInfo) => {
    const suffix = `${testInfo.project.name}-${randomBytes(3).toString("hex")}`;
    const email = `${runEmailPrefix(requireRunId())}${suffix}@example.com`;
    const password = `e2e-${randomBytes(6).toString("hex")}`;
    const displayName = `E2E ${suffix}`;
    const user = await registerAccount({ email, password, displayName });
    try {
      if (signedIn) {
        const { token, expiresAt } = await createSession(user.id);
        await context.addCookies([
          {
            name: SESSION_COOKIE,
            value: token,
            url: baseURL,
            httpOnly: true,
            sameSite: "Lax",
            expires: Math.floor(expiresAt.getTime() / 1000),
          },
        ]);
      }
      await provide({ id: user.id, email, password, displayName });
    } finally {
      // Aucune requête du compte en vol pendant sa suppression (sinon erreurs côté serveur).
      await Promise.all(context.pages().map((page) => settle(page)));
      // Supprimer le compte emporte ses sessions, sa collection et ses decks (cascade).
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  },
});

export { expect };

/** Attend la fin des requêtes de la page (données préchargées au repos comprises), sans échouer. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

/** Capture pleine page dans tests/e2e/screenshots/<appareil>/<nom>.png, pour relecture (pas de comparaison). */
export async function snap(page: Page, name: string) {
  const project = test.info().project.name;
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, project, `${name}.png`), fullPage: true });
}

/** La page ne défile pas horizontalement : rien ne déborde de la largeur de l'écran. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "la page défile horizontalement").toBeLessThanOrEqual(clientWidth);
}
