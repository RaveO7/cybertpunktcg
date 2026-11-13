// Hook PreToolUse (Bash|PowerShell) : dans un worktree sans node_modules à lui, Node utilise celui du projet principal,
// et une génération du client Prisma l'écraserait avec le schéma du worktree. Si ce schéma diffère du principal,
// on bloque les commandes qui génèrent le client jusqu'à l'installation locale (`npm ci`).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input.tool_input?.command ?? "");
const generates =
  /\bprisma(\.mjs)?\b[^|;&]*\b(generate|db\s+push)\b|\bscripts[\\/]prisma\.mjs\b|\bnpm\s+run\s+(dev|build|db:push|import:cards|import:prices)\b/i;
if (!generates.test(command) || /--skip-generate/.test(command) && !/\bgenerate\b/.test(command)) process.exit(0);

const cwd = input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd();
const gitDir = (args) => spawnSync("git", args, { cwd, encoding: "utf8" }).stdout?.trim() ?? "";
const root = gitDir(["rev-parse", "--show-toplevel"]);
if (!root || !statSync(path.join(root, ".git"), { throwIfNoEntry: false })?.isFile()) process.exit(0); // pas un worktree
if (existsSync(path.join(root, "node_modules"))) process.exit(0); // node_modules propre au worktree

const main = path.dirname(path.resolve(root, gitDir(["rev-parse", "--git-common-dir"])));
const schema = (dir) => (existsSync(path.join(dir, "prisma", "schema.prisma")) ? readFileSync(path.join(dir, "prisma", "schema.prisma"), "utf8") : "");
if (schema(root) === schema(main)) process.exit(0); // même schéma : le client généré est identique

console.error(
  `Bloqué : ce worktree modifie prisma/schema.prisma mais utilise le node_modules du projet principal (${main}). ` +
    "Générer le client Prisma ici casserait le projet principal. Lance d'abord `npm ci` dans le worktree, puis relance.",
);
process.exit(2);
