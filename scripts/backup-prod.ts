// Sauvegarde de la base de production (Supabase Free n'en fait aucune) : toutes les tables, en SQL Postgres
// compressé, dans data/backups/prod-<date>.sql.gz. Lecture seule ; les 8 dernières sauvegardes sont gardées.
// Usage, depuis la racine du projet : npx tsx scripts/backup-prod.ts
//   (PROD_DATABASE_URL dans .env.local : pooler Supabase en mode session, port 5432)
// Lancé chaque dimanche par la tâche planifiée Windows (scripts/backup-prod-task.ps1), avec la version de main.
//
// Restaurer dans une base Postgres vide : tables créées par `prisma db push` (DATABASE_URL = la base cible), puis
// le fichier décompressé envoyé par `prisma db execute --file <fichier.sql>` avec la même DATABASE_URL.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { postgresModule, prodUrl } from "./prod-database";
import { insertStatements, readRows, tablesInForeignKeyOrder } from "./sql-dump";

const BACKUP_DIR = path.join("data", "backups");
const KEEP = 8;

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
