import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { requireLocalDatabase } from "./local-db";
import { SCREENSHOTS_DIR } from "./paths";

/**
 * Avant le run : garde SQLite (refaite ici puisque c'est ce processus qui ouvre Prisma), identifiant du
 * run transmis aux tests par l'environnement, captures du run précédent effacées.
 */
export default function globalSetup() {
  requireLocalDatabase();
  process.env.E2E_RUN_ID = randomBytes(4).toString("hex");
  rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
}
