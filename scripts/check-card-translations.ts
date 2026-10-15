/**
 * Liste, pour chaque langue de src/i18n/cards/, les cartes dont le texte de règles n'est pas traduit
 * ou dont la traduction est périmée (texte anglais modifié dans la base depuis la traduction).
 * Lecture seule : aucune écriture en base. Code de sortie 1 s'il reste quelque chose à traduire.
 *
 * Usage : npx tsx scripts/check-card-translations.ts
 */
import fs from "node:fs";
import path from "node:path";
import { translationStatus, type CardTranslations } from "@/i18n/cards";
import { prisma } from "@/lib/prisma";

const DIR = path.join(process.cwd(), "src/i18n/cards");
/** Produits scellés : pas de texte de règles à traduire. */
const SEALED_CARD_TYPES = ["Sealed", "Lot"];

async function main() {
  const cards = await prisma.card.findMany({
    where: { isActive: true, rulesText: { not: null }, OR: [{ cardType: null }, { cardType: { notIn: SEALED_CARD_TYPES } }] },
    select: { slug: true, rulesText: true },
    orderBy: { slug: "asc" },
  });
  let problems = 0;
  for (const file of fs.readdirSync(DIR).filter((name) => name.endsWith(".json")).sort()) {
    const locale = file.replace(/\.json$/, "");
    const translations = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as CardTranslations;
    const missing: string[] = [];
    const stale: string[] = [];
    for (const card of cards) {
      const status = translationStatus(translations, card.slug, card.rulesText);
      if (status === "missing") missing.push(card.slug);
      if (status === "stale") stale.push(card.slug);
    }
    problems += missing.length + stale.length;
    console.log(`${locale} : ${cards.length - missing.length - stale.length}/${cards.length} à jour, ${missing.length} sans traduction, ${stale.length} périmée(s)`);
    for (const slug of missing) console.log(`  - sans traduction : ${slug}`);
    for (const slug of stale) console.log(`  - périmée (texte anglais modifié) : ${slug}`);
  }
  return problems;
}

main()
  .then((problems) => {
    process.exitCode = problems > 0 ? 1 : 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
