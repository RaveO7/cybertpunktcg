/**
 * Copie jetable de la base SQLite de DATABASE_URL, pour les tests qui modifient des données
 * existantes (catalogue, prix…). La vraie base n'est jamais ouverte en écriture.
 *
 * À appeler dans beforeAll, AVANT tout import de src/lib/prisma ; `cleanup()` dans afterAll.
 */
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pushSchema, sqliteFile } from "./sqlite";

export async function openDatabaseCopy(prefix: string) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbFile = path.join(tmpDir, "test.db");
  copyFileSync(sqliteFile(process.env.DATABASE_URL ?? ""), dbFile);
  process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, "/")}`;
  // Schéma à jour sur la copie, même si la base de dev est en retard.
  pushSchema(process.env.DATABASE_URL);

  // Le client Prisma doit être créé après le changement de DATABASE_URL.
  delete (globalThis as { prisma?: unknown }).prisma;
  const { prisma } = await import("../../src/lib/prisma");
  const databases = await prisma.$queryRawUnsafe<{ file: string }[]>("PRAGMA database_list");
  assert.equal(
    path.resolve(databases[0]?.file ?? ""),
    path.resolve(dbFile),
    "le client Prisma doit pointer vers la copie, jamais vers la vraie base",
  );

  return {
    prisma,
    tmpDir,
    async cleanup() {
      await prisma.$disconnect();
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Windows peut garder le fichier verrouillé quelques instants.
      }
    },
  };
}
