// Exporte TOUTE la base locale SQLite (catalogue, prix, comptes, collections…) en un fichier SQL
// Postgres : data/export-postgres.sql. Les sessions ne sont pas copiées (il faudra se reconnecter).
// Le fichier vide d'abord les tables cibles (TRUNCATE) : la base Postgres devient une copie exacte.
// Usage : npx tsx scripts/export-local-to-postgres.ts   (avec DATABASE_URL="file:..." local)
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { insertStatements, readRows, requireLocalDatabase, scalarColumns } from "./sql-dump";

requireLocalDatabase();

const prisma = new PrismaClient();
const OUTPUT = "data/export-postgres.sql";

// Ordre d'insertion compatible avec les clés étrangères.
const MODELS = [
  "Set",
  "Card",
  "CardTag",
  "CardKeyword",
  "Condition",
  "PriceSource",
  "Printing",
  "Price",
  "PriceSnapshot",
  "User",
  "CollectionShare",
  "OAuthAccount",
  "CollectionItem",
  "PortfolioHistoryCache",
] as const;

async function main() {
  const lines = [
    "-- Généré par scripts/export-local-to-postgres.ts — copie de la base locale.",
    "BEGIN;",
    `TRUNCATE ${[...MODELS, "Session"].map((name) => `"${name}"`).join(", ")} CASCADE;`,
  ];
  const counts: Record<string, number> = {};

  for (const name of MODELS) {
    const rows = await readRows(prisma, name);
    counts[name] = rows.length;
    lines.push(...insertStatements(name, scalarColumns(name), rows));
  }

  lines.push("COMMIT;", "");
  writeFileSync(OUTPUT, lines.join("\n"));
  console.log(JSON.stringify({ output: OUTPUT, counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
