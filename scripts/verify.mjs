// Vérification ciblée : ne lance que ce qui concerne les fichiers modifiés depuis origin/main.
// Lancée automatiquement par les hooks Claude (fin de tâche, avant un push) ; à la main : npm run verify.
//
//   npm run verify              typecheck, lint des fichiers modifiés, tests Vitest liés, e2e ciblés (Chrome + Pixel)
//   npm run verify -- --full    avant un push : typecheck, lint complet, tous les Vitest, e2e ciblés sur les 4 appareils
//   npm run verify -- --list    affiche seulement ce qui serait lancé
//
// Rien n'est relancé si le code (fichiers suivis + non suivis) est identique à celui de la dernière vérification
// réussie du même niveau (une vérification --full vaut aussi pour le niveau rapide).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const full = process.argv.includes("--full");
const listOnly = process.argv.includes("--list");

const git = (args, env) => {
  const result = spawnSync("git", args, { encoding: "utf8", env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr.trim()}`);
  return result.stdout.trim();
};
const lines = (text) => text.split("\n").map((line) => line.trim()).filter(Boolean);

// ── Empreinte du code : arbre git de l'état actuel (suivis + non suivis non ignorés), via un index temporaire ──
function fingerprint() {
  const dir = mkdtempSync(path.join(tmpdir(), "verify-"));
  try {
    const env = { GIT_INDEX_FILE: path.join(dir, "index") };
    git(["read-tree", "HEAD"], env);
    git(["add", "-A"], env);
    return git(["write-tree"], env);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const stampFile = path.join(git(["rev-parse", "--absolute-git-dir"]), "verify-stamp.json");
const readStamp = () => {
  try {
    return JSON.parse(readFileSync(stampFile, "utf8"));
  } catch {
    return {};
  }
};

const tree = fingerprint();
const stamp = readStamp();
if (!listOnly && (stamp.full === tree || (!full && stamp.quick === tree))) {
  console.log(`✓ déjà vérifié${full ? " (complet)" : ""} : code inchangé depuis la dernière vérification réussie`);
  process.exit(0);
}

// ── Fichiers modifiés depuis la base (origin/main) ──
const baseRef = spawnSync("git", ["rev-parse", "--verify", "-q", "origin/main"]).status === 0 ? "origin/main" : "main";
const base = git(["merge-base", "HEAD", baseRef]);
const changed = [
  ...new Set([...lines(git(["diff", "--name-only", base])), ...lines(git(["ls-files", "--others", "--exclude-standard"]))]),
].map((file) => file.replaceAll("\\", "/"));
const existing = changed.filter((file) => existsSync(file));

if (changed.length === 0 && !full) {
  console.log("✓ rien à vérifier : aucun changement depuis " + baseRef);
  process.exit(0);
}

const CODE = /\.(c|m)?(t|j)sx?$/;
const CONFIG = /^(package\.json|package-lock\.json|tsconfig\.json|eslint\.config\.\w+|vitest\.config\.\w+|next\.config\.\w+|prisma\/)/;
const codeFiles = existing.filter((file) => CODE.test(file));
const configChanged = changed.some((file) => CONFIG.test(file));

// ── E2E : les specs n'importent pas le code de src/, on les choisit d'après les chemins modifiés ──
const SPECS = lines(git(["ls-files", "tests/e2e/*.spec.ts"])).concat(existing.filter((f) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(f)));
const specName = (file) => path.basename(file, ".spec.ts");
// Mots d'un chemin modifié → spec concernée (en plus du nom de la spec elle-même, ex. « decks », « session »).
const ALIASES = [
  [/investissement|investment/i, ["investment", "investment-performance"]],
  [/\bdecks?\b|deck/i, ["decks"]],
  [/collection/i, ["collection", "offline-sync"]],
  [/offline|service-worker|\/sw\.|\bsw\b/i, ["offline-sync", "offline"]],
  [/session|auth|connexion|RequireUser|login/i, ["session", "layout-shift"]],
  [/tutori|how-?to-?play|comment-jouer|CoachCallout/i, ["tutorial"]],
  [/theme/i, ["theme"]],
  [/push|souhaits|wishlist/i, ["push"]],
  [/loading|skeleton|Suspense/i, ["loading-states"]],
  [/keyboard|BottomNav|TabBar/i, ["keyboard"]],
];
// Fichiers qui touchent toutes les pages : balayage complet + mise en page + thème.
const WIDE = /^(src\/app\/globals\.css|src\/app\/\[locale\]\/layout\.tsx|src\/components\/(AppFrame|Header|Footer)\.tsx|src\/proxy\.ts|src\/i18n\/|messages\/|next\.config\.\w+|playwright\.config\.ts|tests\/e2e\/(fixtures|setup)\/)/;
const UI = /^(src\/app\/(?!api\/)|src\/components\/|src\/i18n\/|messages\/|public\/|src\/lib\/client\/)|\.css$/;

const selected = new Set();
for (const file of existing) if (/^tests\/e2e\/[^/]+\.spec\.ts$/.test(file)) selected.add(specName(file));
if (changed.some((file) => UI.test(file))) selected.add("sweep");
if (changed.some((file) => WIDE.test(file))) ["sweep", "layout-shift", "theme", "a11y"].forEach((name) => selected.add(name));
for (const file of changed.filter((f) => /^src\//.test(f))) {
  for (const spec of SPECS.map(specName)) if (file.toLowerCase().includes(spec.split("-")[0])) selected.add(spec);
  for (const [pattern, specs] of ALIASES) if (pattern.test(file)) specs.forEach((spec) => selected.add(spec));
}
const knownSpecs = new Set(SPECS.map(specName));
const e2eSpecs = [...selected].filter((name) => knownSpecs.has(name)).sort();
const devices = full ? ["iphone", "pixel", "desktop-chrome", "desktop-safari"] : ["desktop-chrome", "pixel"];

// ── Étapes ──
const quote = (file) => `"${file}"`;
const lintable = existing.filter((file) => /\.(c|m)?(t|j)sx?$/.test(file));
const fast = [];
if (full || codeFiles.length || configChanged) fast.push(["typecheck", "npx next typegen && npx tsc --noEmit"]);
if (full || configChanged) fast.push(["lint", "npx eslint --max-warnings 0"]);
else if (lintable.length) fast.push(["lint", `npx eslint --no-warn-ignored --max-warnings 0 ${lintable.map(quote).join(" ")}`]);
if (full || configChanged) fast.push(["vitest", "npx vitest run"]);
else if (codeFiles.length) fast.push(["vitest (liés)", `npx vitest related --run --passWithNoTests ${codeFiles.map(quote).join(" ")}`]);
const e2e = e2eSpecs.length
  ? ["e2e " + e2eSpecs.join(", ") + ` (${devices.join(", ")})`, `npx playwright test ${e2eSpecs.map((s) => `tests/e2e/${s}.spec.ts`).join(" ")} ${devices.map((d) => `--project=${d}`).join(" ")}`]
  : null;

console.log(`${full ? "Vérification complète" : "Vérification ciblée"} — ${changed.length} fichier(s) modifié(s) depuis ${baseRef}`);
if (listOnly) {
  for (const [name, command] of [...fast, ...(e2e ? [e2e] : [])]) console.log(`• ${name}\n    ${command}`);
  if (!e2e) console.log("• e2e : aucun (pas de changement d'interface)");
  process.exit(0);
}

function run([name, command]) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, env: { ...process.env, FORCE_COLOR: "0", CI: process.env.CI ?? "" } });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ name, code, output, seconds: ((Date.now() - started) / 1000).toFixed(0) }));
  });
}
const report = (results) => {
  for (const { name, code, seconds } of results) console.log(`${code === 0 ? "✓" : "✗"} ${name} (${seconds} s)`);
  for (const { name, output } of results.filter((result) => result.code !== 0)) {
    console.log(`\n── ${name} ──\n${output.trim().split("\n").slice(-80).join("\n")}`);
  }
  return results.every((result) => result.code === 0);
};

// Étapes rapides en parallèle, puis les e2e (lents) seulement si elles passent.
let ok = report(await Promise.all(fast.map(run)));
if (ok && e2e) ok = report([await run(e2e)]);
else if (e2e) console.log(`– ${e2e[0]} : non lancé (corriger d'abord les étapes en échec)`);

if (!ok) process.exit(1);
// Le code a pu changer pendant la vérification : on n'enregistre que l'empreinte vérifiée si elle tient encore.
if (fingerprint() === tree) writeFileSync(stampFile, JSON.stringify({ ...readStamp(), quick: tree, ...(full ? { full: tree } : {}) }));
console.log(`✓ vérification ${full ? "complète " : ""}réussie`);
