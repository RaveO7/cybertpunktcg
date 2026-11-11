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

// Plusieurs sessions peuvent travailler dans le même dossier : ne bloquer que sur les erreurs des fichiers
// modifiés par CETTE session (chemins relevés dans son historique). Sans historique lisible, tout compte.
const ownFiles = editedBySession(input.transcript_path);

const result = spawnSync("npx", ["tsc", "--noEmit"], { cwd, encoding: "utf8", shell: true });
if (result.status === 0) {
  lintTyped();
  writeFileSync(stamp, fingerprint);
  process.exit(0);
}

const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n");
let currentFile = null;
const relevant = lines.filter((line) => {
  const header = line.match(/^(\S.*?)\(\d+,\d+\): error /);
  if (header) currentFile = path.resolve(cwd, header[1]).toLowerCase();
  // Erreur sans fichier (configuration TypeScript cassée…) : concerne tout le monde.
  else if (/^error TS\d+/.test(line)) currentFile = "*";
  return !ownFiles || currentFile === "*" || (currentFile !== null && ownFiles.has(currentFile));
});
if (relevant.length === 0) process.exit(0);
console.error(`Le typecheck échoue sur des fichiers que tu as modifiés, corrige-les avant de terminer :\n${relevant.slice(-60).join("\n")}`);
process.exit(2);

// Règles ESLint typées (sautées par le lint après chaque modification) sur les fichiers modifiés de la session.
function lintTyped() {
  const files = changed.filter((file) => existsSync(path.join(cwd, file)) && (!ownFiles || ownFiles.has(path.resolve(cwd, file).toLowerCase())));
  if (files.length === 0) return;
  const lint = spawnSync("npx", ["eslint", "--no-warn-ignored", "--max-warnings", "0", ...files.map((file) => `"${file}"`)], {
    cwd,
    encoding: "utf8",
    shell: true,
  });
  if (lint.status === 0) return;
  console.error(`ESLint (règles typées) échoue sur des fichiers que tu as modifiés, corrige-les avant de terminer :\n${`${lint.stdout ?? ""}${lint.stderr ?? ""}`.trim().slice(-4000)}`);
  process.exit(2);
}

// Fichiers réellement modifiés par la session : appels des outils d'écriture dans son historique (pas les chemins
// simplement cités dans une sortie). Historique absent ou illisible : null, et toutes les erreurs comptent.
function editedBySession(transcriptPath) {
  let text;
  try {
    text = readFileSync(transcriptPath, "utf8");
  } catch {
    return null;
  }
  const files = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "tool_use" && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(node.name ?? "")) {
      const file = node.input?.file_path ?? node.input?.notebook_path;
      if (typeof file === "string") files.add(path.resolve(cwd, file).toLowerCase());
    }
    for (const value of Object.values(node)) visit(value);
  };
  for (const line of text.split("\n")) {
    try {
      visit(JSON.parse(line));
    } catch {
      // Ligne partielle ou illisible : ignorée.
    }
  }
  return files;
}
