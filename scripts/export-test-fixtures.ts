/**
 * Instantané des données PUBLIQUES du catalogue pour la CI (tests/fixtures/), où data/ n'existe pas :
 * extensions, cartes, tags, mots-clés, impressions, prix Cardmarket, et les deux fichiers du guide
 * de prix utilisés pour ces prix. Aucun compte, session, collection ni partage n'est exporté.
 *
 *   npx tsx scripts/export-test-fixtures.ts
 *
 * À relancer après un import important (nouvelle extension) : les tests vérifient des invariants,
 * un instantané plus ancien reste valable.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const root = path.resolve(__dirname, "..");
const out = path.join(root, "tests", "fixtures");
const GUIDE_FILES = ["products_singles_23.json", "price_guide_23.json"];

async function main() {
  if (!(process.env.DATABASE_URL ?? "file:").startsWith("file:")) {
    throw new Error("export-test-fixtures : à lancer sur la base SQLite locale (file:...)");
  }
  const [sets, cards, tags, keywords, printings, prices] = await Promise.all([
    prisma.set.findMany({ orderBy: { code: "asc" } }),
    prisma.card.findMany({ orderBy: { externalId: "asc" } }),
    prisma.cardTag.findMany({ orderBy: [{ cardId: "asc" }, { tag: "asc" }] }),
    prisma.cardKeyword.findMany({ orderBy: [{ cardId: "asc" }, { keyword: "asc" }] }),
    prisma.printing.findMany({ orderBy: { externalId: "asc" } }),
    prisma.price.findMany({
      include: { source: { select: { code: true } }, condition: { select: { code: true } } },
      orderBy: { id: "asc" },
    }),
  ]);
  const catalog = {
    exportedAt: new Date().toISOString(),
    sets,
    cards,
    tags,
    keywords,
    printings,
    // Source et état référencés par leur code : leurs ids diffèrent d'une base à l'autre.
    prices: prices.map(({ source, condition, sourceId: _sourceId, conditionId: _conditionId, ...price }) => ({
      ...price,
      amount: price.amount.toString(),
      previousAmount: price.previousAmount?.toString() ?? null,
      sourceCode: source.code,
      conditionCode: condition?.code ?? null,
    })),
  };
  mkdirSync(path.join(out, "cardmarket"), { recursive: true });
  writeFileSync(path.join(out, "catalog.json"), `${JSON.stringify(catalog)}\n`);
  for (const file of GUIDE_FILES) {
    copyFileSync(path.join(root, "data", "cardmarket", file), path.join(out, "cardmarket", file));
  }
  console.log(
    `export-test-fixtures : ${sets.length} extensions, ${cards.length} cartes, ${printings.length} impressions, ${prices.length} prix.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
