import { defineConfig, devices } from "@playwright/test";
import { requireLocalDatabase } from "./tests/e2e/setup/local-db";

// Avant tout démarrage du serveur : jamais de test contre une autre base que le SQLite local.
const databaseUrl = requireLocalDatabase();

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * Tests e2e sur téléphones émulés (iPhone en WebKit, Pixel en Chromium) et sur ordinateurs émulés
 * (Chrome et Safari desktop : souris, sans écran tactile, mise en page large). Le serveur de test a son propre
 * port et son propre dossier de build : il tourne à côté du `next dev` habituel (port 3000).
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/setup/global-setup.ts",
  globalTeardown: "./tests/e2e/setup/global-teardown.ts",
  // Une seule base SQLite et un serveur qui compile à la demande : exécution en série, sans relance.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    // Téléphone en thème clair, application en thème sombre : le cas des barres du navigateur.
    colorScheme: "light",
    // Le cache hors-ligne ne doit pas servir une version périmée de l'application.
    serviceWorkers: "block",
    locale: "fr-FR",
    trace: "retain-on-failure",
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-safari", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${baseURL}/fr`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      NEXT_DIST_DIR: ".next-e2e",
      // Compteurs du limiteur rangés par IP (x-forwarded-for propre au run), jamais sous « local ».
      TRUST_PROXY: "1",
      APP_URL: baseURL,
    },
  },
});
