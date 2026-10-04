// Lance la CLI Prisma sur le bon schéma selon DATABASE_URL :
// - "file:..."  -> SQLite en local (schéma généré dans prisma/schema.sqlite.prisma, ignoré par git)
// - sinon       -> Postgres (prisma/schema.prisma, utilisé par Vercel)
// Usage : node scripts/prisma.mjs <commande prisma...>   ex. node scripts/prisma.mjs db push
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL ?? "";
let schema = "prisma/schema.prisma";

if (url.startsWith("file:")) {
  const source = readFileSync(schema, "utf8");
  const sqlite = source.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
  if (sqlite === source) throw new Error('provider = "postgresql" introuvable dans prisma/schema.prisma');
  schema = "prisma/schema.sqlite.prisma";
  const banner = "// GÉNÉRÉ par scripts/prisma.mjs depuis schema.prisma — ne pas modifier.\n";
  writeFileSync(schema, banner + sqlite);
}

const result = spawnSync("npx", ["prisma", ...process.argv.slice(2), "--schema", schema], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
