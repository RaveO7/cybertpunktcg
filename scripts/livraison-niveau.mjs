#!/usr/bin/env node
// Niveau de livraison d'un changement, d'après les fichiers touchés (et le type de branche) :
//   aucun   : rien qui change le site (docs, tests, outils, mesures) → fusion directe, aucun build Vercel ;
//   leger   : code de l'app sans base, authentification ni dépendances → fusion sans preview, contrôle en prod ;
//   complet : fonctionnalité (branche feat/), schéma, API, authentification, données, dépendances → preview testée.
//
//   node scripts/livraison-niveau.mjs <base> <head> [--branches b1,b2]   → JSON { niveau, fichiers }
//   node scripts/livraison-niveau.mjs --vercel                           → ignoreCommand de vercel.json
//
// En mode --vercel (code 0 = Vercel annule le build, 1 = il construit) : seule la production peut être sautée,
// quand rien n'a changé côté site depuis le dernier déploiement réussi. Au moindre doute (variable absente,
// historique trop court dans le clone Vercel), on construit. Aucune dépendance : tourne avant `npm install`.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Ordre important : le dernier motif qui correspond l'emporte (« ! » = exclusion, comme .gitignore).
const SANS_BUILD = [
  "docs/**",
  "tests/**",
  "openspec/**",
  ".claude/**",
  ".agents/**",
  ".github/**",
  "**/*.md",
  "scripts/**",
  "!scripts/prisma.mjs",
  "!scripts/vercel-db-push.mjs",
  "!scripts/generate-thumbnails.ts",
  ".gitignore",
  ".worktreeinclude",
  "eslint.config.mjs",
  "knip.json",
  "playwright.config.ts",
  "vitest.config.mts",
];

const COMPLET = [
  "prisma/**",
  "src/app/api/**",
  "src/**/actions.ts",
  "src/proxy.ts",
  "src/lib/auth.ts",
  "src/lib/oauth.ts",
  "src/lib/password.ts",
  "src/lib/session-cookie.ts",
  "src/lib/share-token.ts",
  "src/lib/rate-limit.ts",
  "src/lib/prisma.ts",
  "src/lib/collection-mutate.ts",
  "src/lib/**/repository.ts",
  "src/lib/**/service.ts",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "vercel.json",
  "scripts/prisma.mjs",
  "scripts/vercel-db-push.mjs",
];

const BRANCHES_COMPLET = ["feat/"];

function versRegex(motif) {
  const corps = motif
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${corps}$`);
}

export function correspond(fichier, motifs) {
  let resultat = false;
  for (const motif of motifs) {
    const exclusion = motif.startsWith("!");
    if (versRegex(exclusion ? motif.slice(1) : motif).test(fichier)) resultat = !exclusion;
  }
  return resultat;
}

/** @param {string[]} fichiers @param {string[]} branches @returns {"aucun" | "leger" | "complet"} */
export function classer(fichiers, branches = []) {
  if (branches.some((b) => BRANCHES_COMPLET.some((prefixe) => b.startsWith(prefixe)))) return "complet";
  if (fichiers.some((f) => correspond(f, COMPLET))) return "complet";
  if (fichiers.every((f) => correspond(f, SANS_BUILD))) return "aucun";
  return "leger";
}

function fichiersModifies(base, head) {
  const r = spawnSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).filter(Boolean);
}

function modeVercel() {
  const precedent = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (process.env.VERCEL_ENV !== "production" || !precedent) {
    console.log("Build : preview, ou aucun déploiement réussi de référence.");
    process.exit(1);
  }
  const fichiers = fichiersModifies(precedent, "HEAD");
  if (!fichiers) {
    console.log(`Build : ${precedent} absent du clone, impossible de comparer.`);
    process.exit(1);
  }
  const niveau = classer(fichiers);
  console.log(`${niveau === "aucun" ? "Build sauté" : "Build"} : ${fichiers.length} fichier(s) depuis ${precedent.slice(0, 7)}, niveau ${niveau}.`);
  process.exit(niveau === "aucun" ? 0 : 1);
}

function modeNiveau(args) {
  const [base, head] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--branches");
  const i = args.indexOf("--branches");
  const branches = i >= 0 && args[i + 1] ? args[i + 1].split(",") : [];
  if (!base || !head) {
    console.error("Usage : livraison-niveau.mjs <base> <head> [--branches b1,b2] | --vercel");
    process.exit(2);
  }
  const fichiers = fichiersModifies(base, head);
  if (!fichiers) {
    console.error(`git diff ${base} ${head} impossible.`);
    process.exit(2);
  }
  console.log(JSON.stringify({ niveau: classer(fichiers, branches), fichiers }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--vercel")) modeVercel();
  else modeNiveau(args);
}
