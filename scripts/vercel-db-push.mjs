// Étape du build : sur un déploiement Vercel de PRODUCTION, aligne la structure de la base Postgres
// sur prisma/schema.prisma avant que le nouveau code soit mis en ligne. Les changements qui perdraient
// des données (colonne/table supprimée…) sont refusés par Prisma : le build échoue et rien n'est touché.
// Hors production (local, previews), ne fait rien.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("db push ignoré (pas un déploiement de production).");
  process.exit(0);
}

const result = spawnSync("node", ["scripts/prisma.mjs", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
