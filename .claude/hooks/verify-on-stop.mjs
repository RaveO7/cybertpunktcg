// Hook Stop : quand Claude veut terminer après avoir modifié des fichiers du projet, lance `node scripts/verify.mjs`
// (typecheck, lint, Vitest liés et e2e ciblés, voir ce script). Échec → sortie renvoyée à Claude pour qu'il corrige
// et retente, sans attendre que je le demande. Code inchangé depuis la dernière vérification réussie : instantané.
// Garde-fou : au-delà de 3 échecs d'affilée dans la session, Claude peut s'arrêter (et doit me dire ce qui échoue).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MAX_BLOCKS = 3;
const input = JSON.parse(readFileSync(0, "utf8"));
const cwd = input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd();
const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).stdout?.trim();
if (!root || !existsSync(path.join(root, "scripts", "verify.mjs"))) process.exit(0);

// Seulement si CETTE session a écrit dans ce dossier (une session de questions ne déclenche rien).
if (!sessionEdited(input.transcript_path, path.resolve(root).toLowerCase())) process.exit(0);

const counter = path.join(tmpdir(), `claude-verify-${String(input.session_id ?? "x").replace(/\W/g, "")}`);
const result = spawnSync("node", ["scripts/verify.mjs"], { cwd: root, encoding: "utf8", timeout: 1_500_000 });
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
if (result.status === 0) {
  rmSync(counter, { force: true });
  // Ligne visible par l'utilisateur, sans relancer Claude.
  console.log(JSON.stringify({ systemMessage: output.split("\n").filter((l) => /^[✓✗–]/.test(l)).join(" · ") }));
  process.exit(0);
}

const blocks = Number(existsSync(counter) ? readFileSync(counter, "utf8") : 0) + 1;
if (blocks > MAX_BLOCKS) {
  rmSync(counter, { force: true });
  console.log(JSON.stringify({ systemMessage: `Vérification toujours en échec après ${MAX_BLOCKS} corrections : à signaler.` }));
  process.exit(0);
}
writeFileSync(counter, String(blocks));
console.error(
  `Vérification automatique en échec (essai ${blocks}/${MAX_BLOCKS}). Corrige la cause (pas le test, sauf s'il est faux) ` +
    `puis termine : elle sera relancée.\n${output.slice(-6000)}`,
);
process.exit(2);

/** La session a-t-elle écrit (Edit/Write/…) un fichier sous `root` ? Historique illisible : oui, par prudence. */
function sessionEdited(transcriptPath, rootLower) {
  let text;
  try {
    text = readFileSync(transcriptPath, "utf8");
  } catch {
    return true;
  }
  let found = false;
  const visit = (node) => {
    if (found || !node || typeof node !== "object") return;
    if (node.type === "tool_use" && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(node.name ?? "")) {
      const file = node.input?.file_path ?? node.input?.notebook_path;
      if (typeof file === "string") {
        const resolved = path.resolve(root, file).toLowerCase();
        if (resolved.startsWith(rootLower + path.sep) && !resolved.includes(`${path.sep}node_modules${path.sep}`)) found = true;
      }
    }
    for (const value of Object.values(node)) visit(value);
  };
  for (const line of text.split("\n")) {
    if (!line.includes('"tool_use"')) continue;
    try {
      visit(JSON.parse(line));
    } catch {
      // Ligne partielle ou illisible : ignorée.
    }
  }
  return found;
}
