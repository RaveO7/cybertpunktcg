// Hook PreToolUse (Bash|PowerShell) : refuse toute commande qui exécute du code du projet
// (tests, scripts, serveur, Prisma…) si DATABASE_URL ne pointe pas vers une base SQLite locale.
// Même résolution que scripts/prisma.mjs : variable d'environnement, sinon .env.
// Les envois volontaires vers la prod (sync-local-to-prod, export-local-to-postgres) passent :
// sync-local-to-prod seulement via /sync-prod (simulation puis mon « ok »), export-local-to-postgres par la règle
// "ask" de .claude/settings.json.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input.tool_input?.command ?? "");

const runsProjectCode =
  /\b(vitest|playwright|tsx|prisma|next\s+(dev|build|start))\b/.test(command) ||
  /\bnpm\s+(test|start|run\s+(?!lint\b|typecheck\b)[\w:-]+)/.test(command) ||
  /\bnode\s+\S*scripts[\\/]/.test(command);
const intentionalProd = /sync-local-to-prod|export-local-to-postgres|db:sync-prod|db:export-postgres/.test(command);

if (!runsProjectCode || intentionalProd) process.exit(0);

// Valeur posée dans la commande elle-même : DATABASE_URL=… (bash) ou $env:DATABASE_URL = '…' (PowerShell).
const inline = command.match(/(?:\$env:)?DATABASE_URL\s*=\s*["']?([^"'\s;]+)/);
let url = inline?.[1];
if (url === undefined) {
  const root = input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd();
  const envFile = path.join(root, ".env");
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
  url = process.env.DATABASE_URL ?? "";
}

if (!url.startsWith("file:")) {
  console.error(
    `Bloqué : DATABASE_URL doit pointer vers SQLite (file:...) pour lancer du code du projet, reçu « ${url.split(":")[0] || "vide"} ». ` +
      "Voir CLAUDE.md : jamais de test ni de script contre la base de production.",
  );
  process.exit(2);
}
