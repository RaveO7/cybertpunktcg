// Accès à la base de production depuis un script local (PROD_DATABASE_URL de .env.local : pooler Supabase
// en mode session, port 5432), avec un client Prisma Postgres généré à part : celui du projet suit la base
// locale (SQLite).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma, PrismaClient } from "@prisma/client";

// Schéma lu à côté du script : celui de main quand la tâche planifiée l'extrait (le dossier courant peut dater).
const SCHEMA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");
const CLIENT_DIR = path.join("node_modules", ".prisma-backup");

type PostgresModule = { PrismaClient: new (options: { datasourceUrl: string }) => PrismaClient; Prisma: typeof Prisma };

export function prodUrl() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.PROD_DATABASE_URL;
  if (!url?.startsWith("postgres")) throw new Error("PROD_DATABASE_URL (postgresql://…) absente de .env.local");
  return url;
}

/** Client Postgres régénéré seulement quand le schéma change. */
export function postgresModule(): PostgresModule {
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
