// Hook PreToolUse (Bash, PowerShell) : avant tout `git push`, lance la vérification complète
// (`node scripts/verify.mjs --full` : typecheck, lint et Vitest complets, e2e ciblés sur les 4 appareils).
// Échec → le push n'est pas lancé (code 2) et Claude reçoit la sortie. Code déjà vérifié en complet : instantané.
// Remplace la CI GitHub Actions (bloquée) : rien ne part sur une preview sans être passé ici.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
// Texte entre guillemets retiré : un message de commit qui cite « git push » ne déclenche rien.
const command = String(input.tool_input?.command ?? "").replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "''");
const push = command
  .split(/&&|\|\||;|\||\n/)
  .map((part) => part.trim())
  .find((part) => /^git(\s+-[Cc]\s+\S+)*\s+push\b/.test(part));
if (!push) process.exit(0);
// Suppression d'une branche distante : rien à vérifier.
if (/\s(--delete|-d)\b|\s:\S/.test(push)) process.exit(0);

const cwd = input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd();
const dir = push.match(/^git\s+-C\s+(\S+)/)?.[1];
const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir ? path.resolve(cwd, dir) : cwd, encoding: "utf8" }).stdout?.trim();
if (!root || !existsSync(path.join(root, "scripts", "verify.mjs"))) process.exit(0);

const result = spawnSync("node", ["scripts/verify.mjs", "--full"], { cwd: root, encoding: "utf8", timeout: 2_700_000 });
if (result.status === 0) process.exit(0);
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
console.error(`Push bloqué : la vérification complète échoue. Corrige en local, puis relance le push.\n${output.slice(-6000)}`);
process.exit(2);
