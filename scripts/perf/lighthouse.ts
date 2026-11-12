import { execFile, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { chromium, type Cookie } from "@playwright/test";
import { z } from "zod";

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
};

const run = promisify(execFile);
const CLI = path.join("node_modules", "lighthouse", "cli", "index.js");
const DEBUG_PORT = 9333;

const reportSchema = z.object({
  runtimeError: z.object({ message: z.string() }).optional(),
  categories: z.record(z.string(), z.object({ score: z.number().nullable() })),
  audits: z.record(z.string(), z.object({ numericValue: z.number().optional() })),
});

/**
 * Chromium de Playwright lancé seul, avec les cookies de session posés dans son profil.
 * Sans sandbox, comme Playwright le lance : sinon, sous Windows, son service réseau plante au démarrage.
 */
async function startChrome(cookies: Cookie[]) {
  const profileDir = mkdtempSync(path.join(tmpdir(), "perf-lighthouse-"));
  const chrome = spawn(chromium.executablePath(), [
    "--headless=new",
    "--no-sandbox",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "about:blank",
  ]);
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  // Profil supprimé une fois Chrome fermé : sous Windows, ses fichiers restent verrouillés jusque-là (EBUSY).
  const stop = async () => {
    chrome.kill();
    await exited;
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Playwright pose les cookies puis se détache : deux pilotes en même temps se bloquent
        // (Network.enable timed out), et l'en-tête Cookie de Lighthouse est ignoré par fetch().
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
        await browser.contexts()[0].addCookies(cookies);
        await browser.close();
        return stop;
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
  const stopChrome = await startChrome(cookies);
  try {
    await run(process.execPath, [
      CLI,
      url,
      `--port=${DEBUG_PORT}`,
      "--output=json",
      "--output=html",
      `--output-path=${reportBase}`,
      "--locale=fr",
      "--quiet",
      ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
    ]);
  } finally {
    await stopChrome();
  }

  const { runtimeError, categories, audits } = reportSchema.parse(
    JSON.parse(readFileSync(`${reportBase}.report.json`, "utf8")),
  );
  if (runtimeError) throw new Error(`Lighthouse ${url} : ${runtimeError.message}`);
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
