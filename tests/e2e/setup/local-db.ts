import { existsSync } from "node:fs";

/**
 * Même règle que tests/setup/local-db-only.ts : charge .env sans écraser l'environnement, puis refuse
 * toute base qui n'est pas un fichier SQLite local (cf. CLAUDE.md). Renvoie l'URL vérifiée.
 */
export function requireLocalDatabase() {
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    throw new Error(
      `Tests e2e refusés : DATABASE_URL doit pointer vers une base SQLite locale (file:...), reçu « ${url.split(":")[0] || "vide"} ».`,
    );
  }
  return url;
}
