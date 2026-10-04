// Import local du guide de prix Cardmarket dans la base pointée par DATABASE_URL.
// La logique est dans src/lib/price-import.ts (partagée avec le cron Vercel).
// Options : --offline, --force, --products <f> --prices <f> [--nonsingles <f>]
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importPrices } from "../src/lib/price-import";

const prisma = new PrismaClient();

function arg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const products = arg("--products");
  const prices = arg("--prices");
  const nonsingles = arg("--nonsingles");
  if ((products || prices || nonsingles) && (!products || !prices)) {
    throw new Error("Précisez --products et --prices ensemble.");
  }
  const result = await importPrices(prisma, {
    cacheDir: path.join(process.cwd(), "data", "cardmarket"),
    offline: process.argv.includes("--offline"),
    force: process.argv.includes("--force"),
    files:
      products && prices
        ? {
            products: path.resolve(products),
            prices: path.resolve(prices),
            nonsingles: nonsingles ? path.resolve(nonsingles) : null,
          }
        : undefined,
    log: console.warn,
  });
  if (result.status === "skipped") console.log(result.message);
  else console.log(JSON.stringify(result.report, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
