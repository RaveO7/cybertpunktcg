// Envoie les modifications de la base locale (SQLite) vers la base de production (Postgres Vercel) :
// - structure : `prisma db push` (refuse toute modification qui perdrait des données) ;
// - catalogue (sets, cartes, tirages, états, sources) : ajoutés ou mis à jour, jamais supprimés ;
// - prix et historique de prix : la prod devient identique au local ;
// - collections : les cartes locales absentes de la prod sont ajoutées au compte de même e-mail.
//   Rien n'est supprimé ni modifié dans les collections, comptes et partages de prod.
// Usage : npm run db:sync-prod          (ou --dry-run : génère data/sync-prod.sql sans rien envoyer)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { insertStatements, readRows, requireLocalDatabase, scalarColumns } from "./sql-dump";

requireLocalDatabase();
const prisma = new PrismaClient();
const OUTPUT = "data/sync-prod.sql";
const dryRun = process.argv.includes("--dry-run");

// Ajoutés ou mis à jour (clé : id), dans l'ordre des clés étrangères.
const UPSERTED = ["Set", "Card", "Condition", "PriceSource", "Printing"];
// Remplacés entièrement (aucune autre table ne pointe vers elles).
const REPLACED = ["CardTag", "CardKeyword", "Price", "PriceSnapshot"];

async function buildSql() {
  const lines = ["-- Généré par scripts/sync-local-to-prod.ts", "BEGIN;"];
  const counts: Record<string, number> = {};

  for (const table of UPSERTED) {
    const columns = scalarColumns(table);
    const rows = await readRows(prisma, table);
    counts[table] = rows.length;
    const updates = columns
      .filter((column) => column !== "id")
      .map((column) => `"${column}" = EXCLUDED."${column}"`)
      .join(", ");
    lines.push(...insertStatements(table, columns, rows, `ON CONFLICT ("id") DO UPDATE SET ${updates}`));
  }

  lines.push(`DELETE FROM ${REPLACED.map((table) => `"${table}"`).join(";\nDELETE FROM ")};`);
  for (const table of REPLACED) {
    const rows = await readRows(prisma, table);
    counts[table] = rows.length;
    lines.push(...insertStatements(table, scalarColumns(table), rows));
  }

  // Collection : rattachée par e-mail, n'ajoute que ce qui manque (même tirage + même état).
  const itemColumns = scalarColumns("CollectionItem");
  const items = await prisma.collectionItem.findMany({ include: { user: { select: { email: true } } } });
  const withEmail = items
    .filter((item) => item.user.email)
    .map((item) => ({ ...item, email: item.user.email }));
  counts.CollectionItem = withEmail.length;
  lines.push(`CREATE TEMP TABLE "_LocalItem" (LIKE "CollectionItem", "email" text) ON COMMIT DROP;`);
  lines.push(...insertStatements("_LocalItem", [...itemColumns, "email"], withEmail));
  const selected = itemColumns.map((column) => (column === "userId" ? `u."id"` : `i."${column}"`));
  lines.push(
    `INSERT INTO "CollectionItem" (${itemColumns.map((column) => `"${column}"`).join(", ")})\n` +
      `SELECT ${selected.join(", ")} FROM "_LocalItem" i JOIN "User" u ON u."email" = i."email"\n` +
      `ON CONFLICT DO NOTHING;`,
  );

  // Les courbes de valeur en cache dépendent des prix : elles seront recalculées.
  lines.push(`DELETE FROM "PortfolioHistoryCache";`, "COMMIT;", "");
  writeFileSync(OUTPUT, lines.join("\n"));
  return counts;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) throw new Error(`Échec : ${command} ${args.join(" ")}`);
}

function productionDatabaseUrl() {
  const dir = mkdtempSync(join(tmpdir(), "cptcg-"));
  const file = join(dir, "prod.env");
  try {
    run("vercel", ["env", "pull", `"${file}"`, "--environment", "production", "--yes"]);
    const line = readFileSync(file, "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
    const url = line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
    if (!url?.startsWith("postgres")) throw new Error("DATABASE_URL de production introuvable.");
    return url;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const counts = await buildSql();
  console.log(JSON.stringify({ output: OUTPUT, counts }, null, 2));
  await prisma.$disconnect();
  if (dryRun) return;

  const env = { ...process.env, DATABASE_URL: productionDatabaseUrl() };
  run("node", ["scripts/prisma.mjs", "db", "push", "--skip-generate"], env);
  run("node", ["scripts/prisma.mjs", "db", "execute", "--file", OUTPUT], env);
  console.log("Production synchronisée.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
