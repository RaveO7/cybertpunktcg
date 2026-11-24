// Signale à IndexNow (Bing, Copilot, Yandex…) les fiches de cartes modifiées depuis le dernier envoi.
// Lancé à la fin de /sync-prod : la base locale est alors identique au catalogue de prod.
// Usage : npx tsx scripts/indexnow.ts [--all] [--dry-run]
//   --all      : toutes les pages fixes et toutes les fiches (premier envoi, ou après un changement d'adresse)
//   --dry-run  : affiche ce qui serait envoyé, sans rien envoyer ni retenir la date
// Date du dernier envoi réussi : data/indexnow.json (hors Git).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { INDEXNOW_ENDPOINT, indexNowPayloads, indexNowUrls } from "@/lib/seo/indexnow";
import { requireLocalDatabase } from "./sql-dump";

const PRODUCTION_URL = "https://cybertpunktcg.vercel.app";
const STATE_FILE = "data/indexnow.json";
const stateSchema = z.object({ lastSubmittedAt: z.iso.datetime() });

requireLocalDatabase();
// Les URL du sitemap sont construites avec APP_URL : celles de la prod, pas de localhost.
process.env.APP_URL = PRODUCTION_URL;

const all = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");

function lastSubmittedAt(): Date | null {
  if (all || !existsSync(STATE_FILE)) return null;
  return new Date(stateSchema.parse(JSON.parse(readFileSync(STATE_FILE, "utf8"))).lastSubmittedAt);
}

async function main() {
  // Importés après requireLocalDatabase : le client Prisma lit DATABASE_URL à son chargement.
  const { prisma } = await import("@/lib/prisma");
  const { cardSitemapEntries, staticSitemapEntries } = await import("@/lib/seo/sitemap");
  try {
    const startedAt = new Date();
    const since = lastSubmittedAt();
    const entries = since ? await cardSitemapEntries() : [...staticSitemapEntries(), ...(await cardSitemapEntries())];
    const urls = indexNowUrls(entries, since);
    console.log(`IndexNow : ${urls.length} URL ${since ? `modifiées depuis le ${since.toISOString()}` : "(envoi complet)"}.`);
    if (dryRun || urls.length === 0) return;

    for (const payload of indexNowPayloads(PRODUCTION_URL, urls)) {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      // 200 : reçu ; 202 : reçu, clé en cours de vérification (premier envoi). Le reste est une erreur.
      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`IndexNow a répondu ${response.status} : ${await response.text()}`);
      }
    }
    writeFileSync(STATE_FILE, `${JSON.stringify({ lastSubmittedAt: startedAt.toISOString() })}\n`);
    console.log("IndexNow : envoi accepté.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
