// Hook Stop : quand Claude veut terminer, lance `tsc --noEmit` si des fichiers TypeScript ont changé
// depuis le dernier typecheck réussi. En cas d'erreur, renvoie la sortie à Claude (code 2) pour qu'il corrige.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const cwd = input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd();
const git = (...args) => spawnSync("git", args, { cwd, encoding: "utf8" }).stdout ?? "";

const changed = git("status", "--porcelain", "--untracked-files=all")
  .split("\n")
  .map((line) => line.slice(3).trim().replace(/^"|"$/g, ""))
  .filter((file) => /\.(ts|tsx|mts|cts)$/.test(file));
if (changed.length === 0) process.exit(0);

// Empreinte de l'état courant : inutile de relancer tsc si rien n'a bougé depuis le dernier succès.
const hash = createHash("sha256").update(git("diff", "HEAD"));
for (const file of changed) {
  const full = path.join(cwd, file);
  hash.update(file + (existsSync(full) ? statSync(full).mtimeMs : "deleted"));
}
const fingerprint = hash.digest("hex");
const stamp = path.join(tmpdir(), `claude-typecheck-${createHash("sha256").update(cwd).digest("hex").slice(0, 12)}`);
if (existsSync(stamp) && readFileSync(stamp, "utf8") === fingerprint) process.exit(0);

const result = spawnSync("npx", ["tsc", "--noEmit"], { cwd, encoding: "utf8", shell: true });
if (result.status === 0) {
  writeFileSync(stamp, fingerprint);
  process.exit(0);
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-60).join("\n");
console.error(`Le typecheck échoue, corrige ces erreurs avant de terminer :\n${output}`);
process.exit(2);
