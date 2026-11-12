import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { LighthouseScores } from "./lighthouse";
import type { PageChecks, PageTimings } from "./measure";

export const HISTORY_DIR = path.join("docs", "perf", "history");

export type ProfileName = "mobile" | "desktop";
export type ProfileResult = { timings: PageTimings; checks: PageChecks; lighthouse: LighthouseScores | null };
export type PageResult = { path: string; auth: boolean; profiles: Partial<Record<ProfileName, ProfileResult>> };
export type PerfRun = {
  version: 1;
  date: string;
  label: string;
  baseUrl: string;
  gitSha: string;
  runs: number;
  pages: Record<string, PageResult>;
};

// Lecture d'un ancien fichier : seuls les champs comparés sont vérifiés, le reste peut évoluer.
const numbers = z.record(z.string(), z.number());
const runSchema = z.object({
  date: z.string(),
  label: z.string(),
  pages: z.record(
    z.string(),
    z.object({
      profiles: z.record(z.string(), z.object({ timings: numbers, lighthouse: numbers.nullable() })),
    }),
  ),
});
type StoredRun = z.infer<typeof runSchema>;

export function readRun(file: string): StoredRun {
  return runSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/** Dernière mesure enregistrée (noms horodatés : l'ordre alphabétique est chronologique). */
export function previousRunFile() {
  const files = readdirSync(HISTORY_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(HISTORY_DIR, name))
    .sort();
  return files.at(-1);
}

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

// Colonnes du tableau : [titre, source, clé, unité]. Temps en secondes, poids en Ko, scores sur 100.
const COLUMNS: [string, "timings" | "lighthouse", string, "s" | "kb" | "n" | "score" | "cls"][] = [
  ["TTFB", "timings", "ttfb", "s"],
  ["LCP", "timings", "lcp", "s"],
  ["Visuel", "timings", "visualComplete", "s"],
  ["Complet", "timings", "fullyLoaded", "s"],
  ["CLS", "timings", "cls", "cls"],
  ["Ko", "timings", "totalKB", "kb"],
  ["Req", "timings", "requests", "n"],
  ["LH perf", "lighthouse", "performance", "score"],
  ["LH a11y", "lighthouse", "accessibility", "score"],
  ["LH BP", "lighthouse", "bestPractices", "score"],
  ["LH SEO", "lighthouse", "seo", "score"],
];

function format(value: number, unit: string) {
  return unit === "s" ? (value / 1000).toFixed(2) : unit === "cls" ? value.toFixed(3) : String(Math.round(value));
}

function cell(current: number | undefined, previous: number | undefined, unit: string) {
  if (current === undefined) return "—";
  const text = format(current, unit);
  if (previous === undefined) return text;
  const delta = current - previous;
  // Écart sous le bruit de mesure : pas de flèche.
  const noise = unit === "s" ? 100 : unit === "cls" ? 0.01 : unit === "score" ? 2 : Math.max(5, previous * 0.03);
  if (Math.abs(delta) < noise) return text;
  const better = unit === "score" ? delta > 0 : delta < 0;
  return `${text} ${delta > 0 ? "▲" : "▼"}${format(Math.abs(delta), unit)} ${better ? "✓" : "✗"}`;
}

/** Tableaux markdown (un par profil) de la mesure, avec l'écart à la mesure précédente si fournie. */
export function renderTables(current: StoredRun, previous?: StoredRun) {
  const lines: string[] = [];
  if (previous) lines.push(`Comparé à : ${previous.date} (${previous.label})`, "");
  for (const profile of ["mobile", "desktop"] as const) {
    lines.push(`### ${profile}`, "", `| Page | ${COLUMNS.map(([title]) => title).join(" | ")} |`);
    lines.push(`|---|${COLUMNS.map(() => "---:").join("|")}|`);
    for (const [id, page] of Object.entries(current.pages)) {
      const now = page.profiles[profile];
      if (!now) continue;
      const before = previous?.pages[id]?.profiles[profile];
      const cells = COLUMNS.map(([, source, key, unit]) => cell(now[source]?.[key], before?.[source]?.[key], unit));
      lines.push(`| ${id} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Anomalies fonctionnelles relevées pendant les visites (erreurs console, requêtes en échec, images cassées). */
export function renderProblems(run: PerfRun) {
  const lines: string[] = [];
  for (const [id, page] of Object.entries(run.pages)) {
    for (const [profile, result] of Object.entries(page.profiles)) {
      const { status, finalPath, consoleErrors, failedRequests, brokenImages } = result.checks;
      const issues = [
        status !== 200 && `statut HTTP ${status}`,
        finalPath !== page.path && `redirigé vers ${finalPath}`,
        ...consoleErrors.map((text) => `console : ${text}`),
        ...failedRequests.map((text) => `requête : ${text}`),
        ...brokenImages.map((src) => `image cassée : ${src}`),
      ].filter((issue): issue is string => Boolean(issue));
      for (const issue of issues) lines.push(`- ${id} (${profile}) — ${issue}`);
    }
  }
  return lines.length ? lines.join("\n") : "Aucune anomalie.";
}
