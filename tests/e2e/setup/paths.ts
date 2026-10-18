import path from "node:path";

export const SCREENSHOTS_DIR = path.join(process.cwd(), "tests", "e2e", "screenshots");

/** Préfixe des e-mails des comptes du run : `e2e.<runId>.<n>@example.com`. */
export function runEmailPrefix(runId: string) {
  return `e2e.${runId}.`;
}

/** IP fictive du run (`x-forwarded-for`) : les compteurs du limiteur finissent par `:e2e-<runId>`. */
export function runClientIp(runId: string) {
  return `e2e-${runId}`;
}

export function requireRunId() {
  const runId = process.env.E2E_RUN_ID;
  if (!runId) throw new Error("E2E_RUN_ID absent : lancer les tests avec `npm run test:e2e`.");
  return runId;
}
