import { existsSync } from "node:fs";

// Même chargement que scripts/prisma.mjs : .env seulement, sans écraser l'environnement.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  throw new Error(
    `Tests refusés : DATABASE_URL doit pointer vers une base SQLite locale (file:...), reçu « ${url.split(":")[0] || "vide"} ».`,
  );
}
