// Exporte TOUTE la base locale SQLite (catalogue, prix, comptes, collections…) en un fichier SQL
// Postgres : data/export-postgres.sql. Les sessions ne sont pas copiées (il faudra se reconnecter).
// Le fichier vide d'abord les tables cibles (TRUNCATE) : la base Postgres devient une copie exacte.
// Usage : npx tsx scripts/export-local-to-postgres.ts   (avec DATABASE_URL="file:..." local)
import { writeFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && process.loadEnvFile) process.loadEnvFile(".env");
if (!process.env.DATABASE_URL?.startsWith("file:")) {
  throw new Error("DATABASE_URL doit pointer vers la base SQLite locale (file:...).");
}

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

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toString();
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
  const lines = [
    "-- Généré par scripts/export-local-to-postgres.ts — copie de la base locale.",
    "BEGIN;",
    `TRUNCATE ${[...MODELS, "Session"].map((name) => `"${name}"`).join(", ")} CASCADE;`,
  ];
  const counts: Record<string, number> = {};

  for (const name of MODELS) {
    const model = models.get(name);
    if (!model) throw new Error(`Modèle ${name} absent du schéma`);
    const columns = model.fields.filter((field) => field.kind === "scalar" || field.kind === "enum");
    const delegate = (prisma as unknown as Record<string, { findMany(): Promise<Record<string, unknown>[]> }>)[
      name[0].toLowerCase() + name.slice(1)
    ];
    const rows = await delegate.findMany();
    counts[name] = rows.length;
    const header = `INSERT INTO "${name}" (${columns.map((column) => `"${column.name}"`).join(", ")}) VALUES`;
    for (let start = 0; start < rows.length; start += 500) {
      const values = rows
        .slice(start, start + 500)
        .map((row) => `(${columns.map((column) => literal(row[column.name])).join(", ")})`);
      lines.push(`${header}\n${values.join(",\n")};`);
    }
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
