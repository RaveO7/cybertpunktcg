// Test de fumée d'un déploiement (preview ou production), en lecture seule : chaque page publique et privée
// est ouverte sur ordinateur et téléphone ; on relève statut HTTP, erreurs console, requêtes en échec et
// images cassées. Les previews utilisent la base de production : le script ne fait que se connecter avec le
// compte de test (EMAIL_USER_TEST / EMAIL_PASSWORD_TEST de .env.local) et se déconnecte à la fin, même en cas d'échec.
//
//   node scripts/smoke-preview.mjs <url> [--pages /fr,/fr/cards] [--public-only] [--shots <dossier>]
//
// Preview protégée : le secret « automation bypass » est lu via `vercel api` (ou VERCEL_AUTOMATION_BYPASS_SECRET).
// Code de sortie 1 si une page répond en erreur ou montre une anomalie.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, devices } from "@playwright/test";

const SESSION_COOKIE = "cptcg_session";
const PAGES = [
  { path: "/fr", auth: false },
  { path: "/fr/cartes", auth: false },
  { path: "/fr/cartes/adam-smasher-ender-of-legends", auth: false },
  { path: "/fr/connexion", auth: false },
  { path: "/fr/cgu", auth: false },
  { path: "/fr", auth: true },
  { path: "/fr/tableau-de-bord", auth: true },
  { path: "/fr/cards", auth: true },
  { path: "/fr/decks", auth: true },
  { path: "/fr/investissement", auth: true },
  { path: "/fr/tournois", auth: true },
  { path: "/fr/parametres", auth: true },
];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { pages: { type: "string" }, "public-only": { type: "boolean" }, shots: { type: "string" } },
});
const baseUrl = (positionals[0] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(baseUrl)) {
  console.error("Usage : node scripts/smoke-preview.mjs <url> [--pages /fr,/fr/cards] [--public-only] [--shots <dossier>]");
  process.exit(2);
}

loadEnvLocal();
const bypass = baseUrl.includes(".vercel.app") ? bypassSecret() : null;
// fetch ne garde pas les cookies : seul le navigateur demande le cookie de contournement.
const bypassHeaders = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const browserHeaders = bypass ? { ...bypassHeaders, "x-vercel-set-bypass-cookie": "true" } : {};

const only = values.pages?.split(",").map((p) => p.trim());
const pages = PAGES.filter((p) => (!only || only.includes(p.path)) && !(values["public-only"] && p.auth));

let session = null;
const browser = await chromium.launch();
let failures = 0;
try {
  if (pages.some((p) => p.auth)) session = await login();
  for (const profile of ["desktop", "mobile"]) {
    for (const page of pages) {
      const result = await visit(page, profile);
      const problems = [...result.console, ...result.failed, ...result.broken];
      const ok = result.status < 400 && problems.length === 0;
      if (!ok) failures += 1;
      console.log(`${ok ? "✓" : "✗"} ${profile.padEnd(7)} ${page.auth ? "connecté" : "visiteur"} ${page.path} — HTTP ${result.status}`);
      for (const line of problems) console.log(`    ${line}`);
    }
  }
} finally {
  if (session) await logout(session);
  await browser.close();
}
console.log(failures ? `\n${failures} page(s) en anomalie.` : "\nAucune anomalie.");
process.exit(failures ? 1 : 0);

async function visit(page, profile) {
  const context = await browser.newContext({
    ...(profile === "mobile" ? devices["Pixel 7"] : { viewport: { width: 1440, height: 900 } }),
    extraHTTPHeaders: browserHeaders,
    serviceWorkers: "block",
  });
  if (page.auth && session) {
    const { hostname, protocol } = new URL(baseUrl);
    await context.addCookies([{ name: SESSION_COOKIE, value: session, domain: hostname, path: "/", secure: protocol === "https:", httpOnly: true, sameSite: "Lax" }]);
  }
  const tab = await context.newPage();
  const consoleErrors = [];
  const failed = [];
  tab.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console : ${msg.text().slice(0, 200)}`);
  });
  tab.on("pageerror", (error) => consoleErrors.push(`exception : ${String(error.message).slice(0, 200)}`));
  tab.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/_vercel/")) failed.push(`HTTP ${response.status()} ${response.url()}`);
  });
  tab.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "";
    if (!/ERR_ABORTED/.test(reason)) failed.push(`échec ${reason} ${request.url()}`);
  });
  let response = null;
  try {
    response = await tab.goto(`${baseUrl}${page.path}`, { waitUntil: "load", timeout: 60_000 });
    // Réseau calme attendu au plus 10 s : une page qui interroge en continu n'est pas une anomalie en soi.
    await tab.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  } catch (error) {
    consoleErrors.push(`chargement : ${String(error.message).split("\n")[0]}`);
  }
  // Pages privées : une redirection vers la connexion signifie que la session n'a pas tenu.
  if (page.auth && /\/connexion/.test(tab.url())) consoleErrors.push(`redirigé vers ${tab.url()} (session perdue)`);
  const broken = await tab.$$eval("img", (imgs) =>
    imgs.filter((img) => img.complete && img.naturalWidth === 0 && img.currentSrc).map((img) => `image cassée : ${img.currentSrc}`),
  );
  if (values.shots) {
    mkdirSync(values.shots, { recursive: true });
    const name = `${profile}-${page.auth ? "connecte" : "visiteur"}${page.path.replace(/\//g, "_")}.png`;
    await tab.screenshot({ path: path.join(values.shots, name) });
  }
  await context.close();
  return { status: response?.status() ?? 0, console: consoleErrors, failed, broken };
}

async function login() {
  const email = process.env.EMAIL_USER_TEST;
  const password = process.env.EMAIL_PASSWORD_TEST;
  if (!email || !password) throw new Error("EMAIL_USER_TEST / EMAIL_PASSWORD_TEST absents de .env.local (ou --public-only).");
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl, ...bypassHeaders },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Connexion du compte de test refusée : HTTP ${response.status}`);
  const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!line) throw new Error("Cookie de session absent de la réponse de connexion.");
  return line.slice(SESSION_COOKIE.length + 1).split(";")[0];
}

async function logout(value) {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${value}`, origin: baseUrl, ...bypassHeaders },
  });
  if (!response.ok) console.error(`⚠ Déconnexion du compte de test : HTTP ${response.status}`);
}

function bypassSecret() {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const { projectId } = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
  const project = JSON.parse(
    execSync(`vercel api /v9/projects/${projectId}`, { encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" }, stdio: ["ignore", "pipe", "ignore"] }),
  );
  const entry = Object.entries(project.protectionBypass ?? {}).find(([, v]) => v.scope === "automation-bypass");
  return entry?.[0] ?? null;
}

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  } catch {
    // pas de .env.local : pages publiques seulement
  }
}
