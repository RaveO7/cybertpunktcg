// Hook PostToolUse : après chaque modification d'un fichier JS/TS du projet, lance ESLint sur ce seul fichier.
// Erreur ou avertissement → sortie renvoyée à Claude (code 2) pour qu'il corrige tout de suite, pas en fin de tâche.
// Sans les règles typées (ESLINT_FAST=1, ~4 s au lieu de ~15 s) : typecheck-on-stop.mjs les vérifie en fin de tâche.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path;
if (!file || !/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(file) || !existsSync(file)) process.exit(0);

const project = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const relative = path.relative(project, path.resolve(file));
if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).includes("node_modules")) process.exit(0);

const result = spawnSync("npx", ["eslint", "--no-warn-ignored", "--max-warnings", "0", `"${relative}"`], {
  cwd: project,
  encoding: "utf8",
  shell: true,
  env: { ...process.env, ESLINT_FAST: "1" },
});
if (result.status === 0) process.exit(0);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
console.error(`ESLint signale des problèmes dans ${relative} — corrige-les maintenant :\n${output.slice(0, 4000)}`);
process.exit(2);
