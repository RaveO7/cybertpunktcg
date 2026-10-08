/**
 * Charge le catalogue de test dans une base SQLite VIDE (CI) : l'instantané public
 * tests/fixtures/catalog.json (scripts/export-test-fixtures.ts), avec ses prix Cardmarket.
 * Les fichiers du guide de prix correspondants sont dans tests/fixtures/cardmarket/.
 *
 *   DATABASE_URL=file:./ci.db node scripts/prisma.mjs db push && npm run db:seed && npm run test:ci:seed
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Row = Record<string, unknown>;
type Snapshot = {
  sets: Row[];
  cards: Row[];
  tags: Row[];
  keywords: Row[];
  printings: Row[];
  prices: (Row & { sourceCode: string; conditionCode: string | null })[];
};

const prisma = new PrismaClient();

async function main() {
  if (!(process.env.DATABASE_URL ?? "").startsWith("file:")) {
    throw new Error("seed-ci : DATABASE_URL doit pointer vers une base SQLite (file:...)");
  }
  // Ne jamais mélanger l'instantané avec un catalogue existant.
  if ((await prisma.card.count()) > 0) throw new Error("seed-ci : la base contient déjà des cartes, abandon.");

  const snapshot = JSON.parse(readFileSync(path.join(__dirname, "catalog.json"), "utf8")) as Snapshot;
  // Sources et états viennent de prisma/seed.ts : on les retrouve par leur code.
  const sources = new Map((await prisma.priceSource.findMany()).map((row) => [row.code, row.id]));
  const conditions = new Map((await prisma.condition.findMany()).map((row) => [row.code, row.id]));

  await prisma.set.createMany({ data: snapshot.sets as never });
  await prisma.card.createMany({ data: snapshot.cards as never });
  await prisma.cardTag.createMany({ data: snapshot.tags as never });
  await prisma.cardKeyword.createMany({ data: snapshot.keywords as never });
  await prisma.printing.createMany({ data: snapshot.printings as never });
  await prisma.price.createMany({
    data: snapshot.prices.map(({ sourceCode, conditionCode, ...price }) => {
      const sourceId = sources.get(sourceCode);
      if (!sourceId) throw new Error(`seed-ci : source de prix inconnue « ${sourceCode} » (lancer npm run db:seed)`);
      return { ...price, sourceId, conditionId: conditionCode ? (conditions.get(conditionCode) ?? null) : null };
    }) as never,
  });
  console.log(
    `seed-ci : ${snapshot.cards.length} cartes, ${snapshot.printings.length} impressions, ${snapshot.prices.length} prix.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
