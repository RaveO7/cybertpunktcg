import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");

/** Chemin du fichier SQLite d'une URL `file:` (relative au dossier prisma/, comme pour Prisma). */
export function sqliteFile(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) throw new Error("DATABASE_URL doit pointer vers une base SQLite (file:...)");
  const target = databaseUrl.slice("file:".length).split("?")[0];
  const file = path.isAbsolute(target) ? target : path.resolve(root, "prisma", target);
  if (!existsSync(file)) throw new Error(`base introuvable: ${file}`);
  return file;
}

/** `prisma db push` sur une base SQLite donnée (copie de test). */
export function pushSchema(databaseUrl: string) {
  const push = spawnSync("node", ["scripts/prisma.mjs", "db", "push", "--skip-generate", "--accept-data-loss"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    shell: true,
  });
  if (push.status !== 0) throw new Error(`prisma db push a échoué:\n${push.stdout}\n${push.stderr}`);
}
