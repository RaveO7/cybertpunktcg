import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const hook = path.join(root, ".claude/hooks/guard-local-db.mjs");

/** Code de sortie du hook pour une commande : 0 = lancée, 2 = bloquée. */
function decide(command: string, cwd = root) {
  const input = JSON.stringify({ cwd, tool_input: { command } });
  // Sans DATABASE_URL hérité : le hook doit la trouver dans la commande ou dans un .env.
  const { DATABASE_URL: _inherited, ...env } = process.env;
  void _inherited;
  return spawnSync("node", [hook], { input, encoding: "utf8", env }).status;
}

const PROD = "DATABASE_URL=postgres://u:p@h/db";

describe("garde DATABASE_URL", () => {
  it.each([
    `${PROD} npx tsx scripts/import-prices.ts`,
    `${PROD} npx vitest run tests/db`,
    `${PROD} npx playwright test`,
    `${PROD} npm run test:db`,
    `${PROD} node scripts/prisma.mjs db push`,
    `${PROD} npx next build`,
    `cd x && ${PROD} tsx scripts/a.ts`,
  ])("bloque une exécution vers une base non SQLite : %s", (command) => {
    expect(decide(command)).toBe(2);
  });

  it.each([
    `${PROD} grep -rn "DeckEditor" src --include=*.tsx`,
    `${PROD} cat src/components/site/SiteShell.tsx`,
    `${PROD} cat prisma/schema.prisma`,
    `${PROD} git log -- src/components/CardModal.tsx`,
    `${PROD} node ~/.claude/scripts/train-livraison.mjs etat`,
    `${PROD} npm run lint`,
  ])("laisse passer ce qui n'exécute pas de code du projet : %s", (command) => {
    expect(decide(command)).toBe(0);
  });

  it("sans .env dans le dossier courant, lit celui du dossier principal", () => {
    expect(decide("npx vitest run tests/unit/x.test.ts", path.join(root, "src"))).toBe(0);
  });

  it("laisse passer une exécution vers SQLite", () => {
    expect(decide('DATABASE_URL="file:../data/collection.db" npx tsx scripts/a.ts')).toBe(0);
  });
});
