// Erreurs JavaScript des visiteurs gardées en production (table ClientError, 30 jours), en lecture seule :
// regroupées par message, avec les pages, les navigateurs et les dates, puis le détail des plus récentes.
// Usage, depuis la racine du projet : npx tsx scripts/client-errors.ts [--days 7] [--match 418] [--detail 5]
//   (PROD_DATABASE_URL dans .env.local, comme scripts/backup-prod.ts)
import { parseArgs } from "node:util";
import { postgresModule, prodUrl } from "./prod-database";

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "7" },
    match: { type: "string" },
    detail: { type: "string", default: "5" },
  },
});

async function main() {
  const { PrismaClient: Client } = postgresModule();
  const prisma = new Client({ datasourceUrl: prodUrl() });
  try {
    const since = new Date(Date.now() - Number(values.days) * 24 * 60 * 60 * 1000);
    const rows = await prisma.clientError.findMany({
      where: { createdAt: { gte: since }, ...(values.match ? { message: { contains: values.match } } : {}) },
      orderBy: { createdAt: "desc" },
    });
    console.log(`${rows.length} erreur(s) depuis le ${since.toISOString().slice(0, 16)}${values.match ? ` contenant « ${values.match} »` : ""}\n`);

    const groups = Map.groupBy(rows, (row) => row.message);
    for (const [message, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      const count = (labels: string[]) =>
        [...Map.groupBy(labels, (label) => label)].map(([value, list]) => `${value} ×${list.length}`).join(", ");
      console.log(`## ${items.length} × ${message}`);
      console.log(`   pages : ${count(items.map((item) => item.path))}`);
      console.log(`   navigateurs : ${count(items.map((item) => browserName(item.userAgent)))}`);
      console.log(`   service worker : ${items.filter((item) => item.serviceWorker).length}/${items.length}`);
      console.log(`   du ${items.at(-1)!.createdAt.toISOString().slice(0, 16)} au ${items[0].createdAt.toISOString().slice(0, 16)}\n`);
    }

    for (const row of rows.slice(0, Number(values.detail))) {
      console.log(`--- ${row.createdAt.toISOString()} ${row.path}\n${row.userAgent ?? "navigateur inconnu"}\n${row.message}\n${row.stack ?? ""}\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

/** Navigateur et appareil, assez pour regrouper sans afficher tout l'en-tête. */
function browserName(userAgent: string | null) {
  if (!userAgent) return "inconnu";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "autre";
  const device = /Mobile|Android|iPhone/.test(userAgent) ? "mobile" : "ordinateur";
  return `${browser} ${device}`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
