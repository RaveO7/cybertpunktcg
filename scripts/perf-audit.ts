// Mesure répétable du site en ligne : temps de chargement réels (Playwright, visites à froid, médiane de N),
// scores Lighthouse (mobile + ordinateur, médiane de N passages, ceux où Lighthouse plante écartés) et anomalies visibles (erreurs console, requêtes en échec, images cassées).
// Chaque mesure est enregistrée dans docs/perf/history/ et comparée à la précédente.
//
// Usage :
//   npx tsx scripts/perf-audit.ts [--url https://…] [--runs 3] [--label "avant cache images"]
//                                 [--only accueil,catalogue] [--no-lighthouse] [--public-only]
//   npx tsx scripts/perf-audit.ts --compare docs/perf/history/A.json docs/perf/history/B.json
// Pages privées : compte de test lu dans EMAIL_USER_TEST / EMAIL_PASSWORD_TEST (.env.local). La session ouverte
// est fermée à la fin, même en cas d'échec. Rien n'est écrit en base hormis cette session.
// Preview protégée (Vercel Authentication) : secret « Protection Bypass for Automation » du projet dans
// VERCEL_AUTOMATION_BYPASS_SECRET.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, devices, type BrowserContextOptions, type Cookie } from "@playwright/test";
import { runLighthouseMedian } from "./perf/lighthouse";
import { measurePage, type PageMeasure } from "./perf/measure";
import { PERF_PAGES } from "./perf/pages";
import {
  HISTORY_DIR,
  median,
  previousRunFile,
  readRun,
  renderProblems,
  renderTables,
  type PageResult,
  type PerfRun,
  type ProfileName,
} from "./perf/report";

const DEFAULT_URL = "https://cybertpunktcg.vercel.app";
const SESSION_COOKIE = "cptcg_session";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const BYPASS_HEADERS: Record<string, string> = BYPASS_SECRET ? { "x-vercel-protection-bypass": BYPASS_SECRET } : {};
const LIGHTHOUSE_DIR = path.join("test-results", "perf-lighthouse");

const PROFILES: Record<ProfileName, BrowserContextOptions> = {
  mobile: devices["Pixel 7"],
  desktop: devices["Desktop Chrome"],
};

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: DEFAULT_URL },
    runs: { type: "string", default: "3" },
    label: { type: "string", default: "" },
    only: { type: "string" },
    "no-lighthouse": { type: "boolean", default: false },
    "public-only": { type: "boolean", default: false },
    compare: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

async function login(baseUrl: string): Promise<Cookie> {
  const email = process.env.EMAIL_USER_TEST;
  const password = process.env.EMAIL_PASSWORD_TEST;
  if (!email || !password) {
    throw new Error("EMAIL_USER_TEST / EMAIL_PASSWORD_TEST absents de .env.local (ou lancer avec --public-only).");
  }
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl, ...BYPASS_HEADERS },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Connexion du compte de test refusée : HTTP ${response.status}`);
  const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!line) throw new Error("Cookie de session absent de la réponse de connexion.");
  const value = line.slice(SESSION_COOKIE.length + 1).split(";")[0];
  const { hostname, protocol } = new URL(baseUrl);
  return {
    name: SESSION_COOKIE,
    value,
    domain: hostname,
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: protocol === "https:",
    sameSite: "Lax",
  };
}

/** Cookie de contournement de la protection Vercel, posé dans chaque navigateur (pages et Lighthouse). */
async function bypassCookie(baseUrl: string): Promise<Cookie | null> {
  if (!BYPASS_SECRET) return null;
  const response = await fetch(baseUrl, {
    headers: { ...BYPASS_HEADERS, "x-vercel-set-bypass-cookie": "true" },
    redirect: "manual",
  });
  const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith("_vercel_jwt="));
  if (!line) throw new Error(`Cookie de contournement Vercel absent (HTTP ${response.status}) : secret invalide ?`);
  const { hostname } = new URL(baseUrl);
  return {
    name: "_vercel_jwt",
    value: line.slice("_vercel_jwt=".length).split(";")[0],
    domain: hostname,
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  };
}

async function logout(baseUrl: string, session: Cookie) {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: `${session.name}=${session.value}`, origin: baseUrl, ...BYPASS_HEADERS },
  });
  if (!response.ok) console.error(`⚠ Déconnexion du compte de test : HTTP ${response.status}`);
}

function mergeRuns(measures: PageMeasure[]): PageMeasure {
  const keys = Object.keys(measures[0].timings) as (keyof PageMeasure["timings"])[];
  const timings = Object.fromEntries(
    keys.map((key) => [key, key === "cls" ? Math.max(...measures.map((m) => m.timings.cls)) : median(measures.map((m) => m.timings[key]))]),
  ) as PageMeasure["timings"];
  const unique = (pick: (m: PageMeasure) => string[]) => [...new Set(measures.flatMap(pick))];
  return {
    timings,
    checks: {
      status: measures.find((m) => m.checks.status !== 200)?.checks.status ?? 200,
      finalPath: measures[0].checks.finalPath,
      consoleErrors: unique((m) => m.checks.consoleErrors),
      failedRequests: unique((m) => m.checks.failedRequests),
      brokenImages: unique((m) => m.checks.brokenImages),
    },
  };
}

function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch (error) {
    // Hors dépôt git : la mesure reste valable, seul le repère de version manque.
    console.error(`git indisponible : ${String(error)}`);
    return "inconnu";
  }
}

async function audit() {
  const baseUrl = args.url.replace(/\/$/, "");
  const runs = Math.max(1, Number(args.runs));
  const only = args.only?.split(",");
  const pages = PERF_PAGES.filter((page) => (!only || only.includes(page.id)) && !(args["public-only"] && page.auth));
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outFile = path.join(HISTORY_DIR, `${stamp}.json`);

  const bypass = await bypassCookie(baseUrl);
  const session = pages.some((page) => page.auth) ? await login(baseUrl) : null;
  const browser = await chromium.launch();
  const results: Record<string, PageResult> = {};
  try {
    for (const page of pages) {
      const url = `${baseUrl}${page.path}`;
      const cookies = [...(bypass ? [bypass] : []), ...(page.auth && session ? [session] : [])];
      results[page.id] = { path: page.path, auth: page.auth, profiles: {} };
      for (const [profile, device] of Object.entries(PROFILES) as [ProfileName, BrowserContextOptions][]) {
        const measures: PageMeasure[] = [];
        for (let run = 0; run < runs; run += 1) measures.push(await measurePage(browser, url, device, cookies));
        let lighthouse = null;
        if (!args["no-lighthouse"]) {
          lighthouse = await runLighthouseMedian(url, profile, path.join(LIGHTHOUSE_DIR, `${page.id}-${profile}`), cookies, runs);
        }
        const merged = mergeRuns(measures);
        results[page.id].profiles[profile] = { ...merged, lighthouse };
        const { visualComplete, fullyLoaded } = merged.timings;
        console.log(
          `✓ ${page.id} ${profile} — visuel ${(visualComplete / 1000).toFixed(2)} s, complet ${(fullyLoaded / 1000).toFixed(2)} s` +
            (lighthouse ? `, Lighthouse perf ${lighthouse.performance} (médiane de ${lighthouse.runs})` : ", Lighthouse : aucun passage valide"),
        );
      }
    }
  } finally {
    await browser.close();
    if (session) await logout(baseUrl, session);
  }

  const run: PerfRun = { version: 1, date: new Date().toISOString(), label: args.label, baseUrl, gitSha: gitSha(), runs, pages: results };
  mkdirSync(HISTORY_DIR, { recursive: true });
  const previous = previousRunFile();
  writeFileSync(outFile, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`\n## Mesure ${run.date} — ${baseUrl} (${run.gitSha}, médiane de ${runs})\n`);
  console.log(renderTables(readRun(outFile), previous ? readRun(previous) : undefined));
  console.log(`### Anomalies\n\n${renderProblems(run)}\n`);
  console.log(`Enregistré : ${outFile}${args["no-lighthouse"] ? "" : ` · rapports Lighthouse : ${LIGHTHOUSE_DIR}/`}`);
}

async function main() {
  if (args.compare) {
    const [before, after] = process.argv.slice(2).filter((arg) => arg.endsWith(".json"));
    if (!before || !after) throw new Error("--compare attend deux fichiers .json (avant, après).");
    console.log(renderTables(readRun(after), readRun(before)));
    return;
  }
  await audit();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
