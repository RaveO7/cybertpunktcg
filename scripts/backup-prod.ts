// Sauvegarde de la base de production (Supabase Free n'en fait aucune) : toutes les tables, en SQL Postgres
// compressé, dans data/backups/prod-<date>.sql.gz. Lecture seule ; les 8 dernières sauvegardes sont gardées.
// Usage, depuis la racine du projet : npx tsx scripts/backup-prod.ts
//   (PROD_DATABASE_URL dans .env.local : pooler Supabase en mode session, port 5432)
// Lancé chaque dimanche par la tâche planifiée Windows (scripts/backup-prod-task.ps1), avec la version de main.
//
// Restaurer dans une base Postgres vide : tables créées par `prisma db push` (DATABASE_URL = la base cible), puis
// le fichier décompressé envoyé par `prisma db execute --file <fichier.sql>` avec la même DATABASE_URL.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { Prisma, PrismaClient } from "@prisma/client";
import { insertStatements, readRows, tablesInForeignKeyOrder } from "./sql-dump";

const BACKUP_DIR = path.join("data", "backups");
const KEEP = 8;
// Schéma lu à côté du script : celui de main quand la tâche planifiée l'extrait (le dossier courant peut dater).
const SCHEMA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");
// Client Prisma généré pour Postgres à part : celui du projet suit la base locale (SQLite).
const CLIENT_DIR = path.join("node_modules", ".prisma-backup");

type PostgresModule = { PrismaClient: new (options: { datasourceUrl: string }) => PrismaClient; Prisma: typeof Prisma };

function prodUrl() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.PROD_DATABASE_URL;
  if (!url?.startsWith("postgres")) throw new Error("PROD_DATABASE_URL (postgresql://…) absente de .env.local");
  return url;
}

/** Client Postgres régénéré seulement quand le schéma change. */
function postgresModule(): PostgresModule {
  const schema = readFileSync(SCHEMA, "utf8").replace(
    /generator client \{[^}]*\}/,
    'generator client {\n  provider = "prisma-client-js"\n  output   = "./client"\n}',
  );
  const schemaFile = path.join(CLIENT_DIR, "schema.prisma");
  if (!existsSync(schemaFile) || readFileSync(schemaFile, "utf8") !== schema || !existsSync(path.join(CLIENT_DIR, "client"))) {
    mkdirSync(CLIENT_DIR, { recursive: true });
    writeFileSync(schemaFile, schema);
    execFileSync("npx", ["prisma", "generate", "--schema", schemaFile], { stdio: "ignore", shell: true });
  }
  return createRequire(path.resolve("package.json"))(path.resolve(CLIENT_DIR, "client"));
}

async function main() {
  const url = prodUrl();
  const { PrismaClient: Client, Prisma: pg } = postgresModule();
  const models = pg.dmmf.datamodel.models;
  const prisma = new Client({ datasourceUrl: url });
  const lines = [`-- Sauvegarde de ${new URL(url).host}, ${new Date().toISOString()} (scripts/backup-prod.ts)`, "BEGIN;"];
  const counts: string[] = [];
  try {
    for (const table of tablesInForeignKeyOrder(models)) {
      const columns = models.find((model) => model.name === table)!.fields.filter((field) => field.kind === "scalar" || field.kind === "enum").map((field) => field.name);
      const rows = await readRows(prisma, table);
      counts.push(`${table} ${rows.length}`);
      lines.push(...insertStatements(table, columns, rows));
    }
  } finally {
    await prisma.$disconnect();
  }
  lines.push("COMMIT;");

  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `prod-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.sql.gz`);
  writeFileSync(file, gzipSync(lines.join("\n")));
  const old = readdirSync(BACKUP_DIR).filter((name) => /^prod-.*\.sql\.gz$/.test(name)).sort().slice(0, -KEEP);
  for (const name of old) rmSync(path.join(BACKUP_DIR, name));
  console.log(`${file} (${counts.join(", ")})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
