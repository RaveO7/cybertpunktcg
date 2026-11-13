import { execFile, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { chromium, type Cookie } from "@playwright/test";
import { z } from "zod";
import { MEASURE_HEADERS } from "./measure";

export type LighthouseScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  // Métriques de laboratoire (réseau et processeur simulés : comparables d'une machine à l'autre).
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  speedIndex: number;
  /** Passages valides dont ces valeurs sont la médiane (absent : ancien format, un seul passage). */
  runs?: number;
};

type MetricKey = Exclude<keyof LighthouseScores, "runs">;
const METRICS: MetricKey[] = ["performance", "accessibility", "bestPractices", "seo", "fcp", "lcp", "tbt", "cls", "speedIndex"];
// Passages supplémentaires tentés pour remplacer ceux où Lighthouse plante.
const EXTRA_ATTEMPTS = 2;

const run = promisify(execFile);
const CLI = path.join("node_modules", "lighthouse", "cli", "index.js");

/** Port libre pour le débogage de Chrome : jamais celui d'un Chrome lancé par une autre mesure. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

const reportSchema = z.object({
  runtimeError: z.object({ message: z.string() }).optional(),
  finalDisplayedUrl: z.string().optional(),
  categories: z.record(z.string(), z.object({ score: z.number().nullable() })),
  audits: z.record(z.string(), z.object({ numericValue: z.number().optional() })),
});

/**
 * Chromium de Playwright lancé seul, avec les cookies de session posés dans son profil.
 * Sans sandbox, comme Playwright le lance : sinon, sous Windows, son service réseau plante au démarrage.
 */
async function startChrome(cookies: Cookie[]) {
  const port = await freePort();
  const profileDir = mkdtempSync(path.join(tmpdir(), "perf-lighthouse-"));
  const chrome = spawn(chromium.executablePath(), [
    "--headless=new",
    "--no-sandbox",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "about:blank",
  ]);
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  // Profil supprimé une fois Chrome fermé : sous Windows, ses fichiers restent verrouillés jusque-là (EBUSY).
  const stop = async () => {
    chrome.kill();
    await exited;
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      // Profil temporaire encore verrouillé par Windows : la mesure reste valable, le dossier sera nettoyé plus tard.
      console.warn(`⚠ Profil Chrome non supprimé (${profileDir}) : ${String(error)}`);
    }
  };
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Playwright pose les cookies puis se détache : deux pilotes en même temps se bloquent
        // (Network.enable timed out), et l'en-tête Cookie de Lighthouse est ignoré par fetch().
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        await browser.contexts()[0].addCookies(cookies);
        await browser.close();
        return { stop, port };
      } catch (error) {
        if (attempt >= 50) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  } catch (error) {
    await stop();
    throw error;
  }
}

/**
 * Audit Lighthouse dans un Chromium neuf ; rapports en `<reportBase>.report.{html,json}`.
 * Lancé par la CLI dans un Node séparé : sous tsx, les fonctions que Lighthouse exécute dans la page
 * seraient réécrites (`__name`) et planteraient dans le navigateur.
 */
export async function runLighthouse(
  url: string,
  formFactor: "mobile" | "desktop",
  reportBase: string,
  cookies: Cookie[],
): Promise<LighthouseScores> {
  mkdirSync(path.dirname(reportBase), { recursive: true });
  const { stop: stopChrome, port } = await startChrome(cookies);
  try {
    await run(process.execPath, [
      CLI,
      url,
      `--port=${port}`,
      "--output=json",
      "--output=html",
      `--output-path=${reportBase}`,
      "--locale=fr",
      "--quiet",
      `--extra-headers=${JSON.stringify(MEASURE_HEADERS)}`,
      ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
    ]);
  } finally {
    await stopChrome();
  }

  const { runtimeError, finalDisplayedUrl, categories, audits } = reportSchema.parse(
    JSON.parse(readFileSync(`${reportBase}.report.json`, "utf8")),
  );
  if (runtimeError) throw new Error(`Lighthouse ${url} : ${runtimeError.message}`);
  // Redirigé ailleurs (page de connexion Vercel, autre page) : ce n'est pas la page demandée qui a été mesurée.
  if (finalDisplayedUrl && !samePage(finalDisplayedUrl, url)) {
    throw new Error(`Lighthouse ${url} : page mesurée différente (${finalDisplayedUrl})`);
  }
  // Score absent : Lighthouse n'a pas pu mesurer la page (passage à écarter, pas un score de 0).
  if (categories.performance?.score == null) throw new Error(`Lighthouse ${url} : score de performance absent`);
  const score = (key: string) => Math.round((categories[key]?.score ?? 0) * 100);
  const metric = (key: string) => Math.round(audits[key]?.numericValue ?? 0);
  return {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    fcp: metric("first-contentful-paint"),
    lcp: metric("largest-contentful-paint"),
    tbt: metric("total-blocking-time"),
    cls: Math.round((audits["cumulative-layout-shift"]?.numericValue ?? 0) * 1000) / 1000,
    speedIndex: metric("speed-index"),
  };
}

/** Même origine et même chemin (requête, ancre et « / » final ignorés). */
export function samePage(actual: string, expected: string) {
  const a = new URL(actual);
  const b = new URL(expected);
  return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
}

/** Médiane de chaque métrique (moyenne des deux du milieu pour un nombre pair ; CLS au millième). */
export function medianScores(runs: LighthouseScores[]): LighthouseScores {
  const middle = (key: MetricKey) => {
    const sorted = runs.map((scores) => scores[key]).sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    const value = sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
    return key === "cls" ? Math.round(value * 1000) / 1000 : Math.round(value);
  };
  return Object.fromEntries(METRICS.map((key) => [key, middle(key)])) as LighthouseScores;
}

/**
 * `runs` audits Lighthouse valides de la page, médiane de chaque métrique. Un passage où Lighthouse plante
 * (erreur, page bloquée, score absent) est écarté et remplacé, dans la limite de EXTRA_ATTEMPTS essais.
 * Rapport détaillé gardé en `<reportBase>.report.{html,json}` : celui du passage au score médian.
 */
export async function runLighthouseMedian(
  url: string,
  formFactor: "mobile" | "desktop",
  reportBase: string,
  cookies: Cookie[],
  runs: number,
): Promise<LighthouseScores | null> {
  const valid: { scores: LighthouseScores; base: string }[] = [];
  for (let attempt = 1; valid.length < runs && attempt <= runs + EXTRA_ATTEMPTS; attempt += 1) {
    const base = `${reportBase}-${attempt}`;
    try {
      valid.push({ scores: await runLighthouse(url, formFactor, base, cookies), base });
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.error(`⚠ Lighthouse ${formFactor} passage ${attempt} écarté : ${message}`);
    }
  }
  if (valid.length === 0) return null;
  const scores = medianScores(valid.map((entry) => entry.scores));
  const reference = valid.reduce((best, entry) =>
    Math.abs(entry.scores.performance - scores.performance) < Math.abs(best.scores.performance - scores.performance) ? entry : best,
  );
  for (const extension of ["html", "json"]) copyFileSync(`${reference.base}.report.${extension}`, `${reportBase}.report.${extension}`);
  return { ...scores, runs: valid.length };
}
