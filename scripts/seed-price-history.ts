/**
 * Recalcule previousAmount + snapshot "hier" à partir d'un ancien guide Cardmarket.
 * Usage: npx tsx scripts/seed-price-history.ts [ancien_price_guide.json]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parsePriceFile } from "../src/lib/cardmarket";
import { sealedProductId } from "../src/lib/cardmarket-sealed";
import { shiftUtcDay, utcDay, utcDayKey } from "../src/lib/price-history";

const prisma = new PrismaClient();
const ROOT = process.cwd();

async function main() {
  const archive =
    process.argv[2] ??
    path.join(ROOT, "data/cardmarket/archive/price_guide_23_2026-09-28-matin.json");
  const oldTrends = parsePriceFile(await readFile(archive, "utf8"));
  const source = await prisma.priceSource.findUnique({ where: { code: "cardmarket" } });
  if (!source) throw new Error("Source cardmarket introuvable.");

  const prices = await prisma.price.findMany({
    where: { sourceId: source.id, kind: "trend" },
    select: {
      id: true,
      printingId: true,
      amount: true,
      printing: { select: { externalId: true } },
    },
  });

  // Map printing -> cardmarket product id via sealed externalId, else via current matching is harder.
  // For sealed: cardmarket:ID. For singles we need product id from assignments — use price snapshots /
  // reverse via matching current amount to old guide is fragile.
  // Better: re-parse current products and match like import, but simplest path:
  // store productId is NOT on Price. Use printing.externalId for sealed; for singles look up from
  // products file by matching through a fresh match report.

  const { matchCardmarketPrices, parseProductFile } = await import("../src/lib/cardmarket");
  const products = parseProductFile(
    await readFile(path.join(ROOT, "data/cardmarket/products_singles_23.json"), "utf8"),
  );
  const [sets, printings] = await Promise.all([
    prisma.set.findMany({ select: { code: true, name: true } }),
    prisma.printing.findMany({
      where: { isActive: true, NOT: { externalId: { startsWith: "cardmarket:" } } },
      select: {
        id: true,
        collectorNumber: true,
        set: { select: { code: true } },
        card: { select: { canonicalName: true } },
      },
    }),
  ]);
  const currentTrends = parsePriceFile(
    await readFile(path.join(ROOT, "data/cardmarket/price_guide_23.json"), "utf8"),
  );
  const report = matchCardmarketPrices(
    products,
    currentTrends,
    sets,
    printings.map((printing) => ({
      id: printing.id,
      setCode: printing.set.code,
      collectorNumber: printing.collectorNumber,
      name: printing.card.canonicalName,
    })),
  );

  const productIdByPrinting = new Map<string, number>();
  for (const assignment of report.assignments) {
    productIdByPrinting.set(assignment.printingId, assignment.productId);
  }
  const sealed = await prisma.printing.findMany({
    where: { externalId: { startsWith: "cardmarket:" } },
    select: { id: true, externalId: true },
  });
  for (const printing of sealed) {
    const id = sealedProductId(printing.externalId);
    if (id != null) productIdByPrinting.set(printing.id, id);
  }

  const yesterday = shiftUtcDay(utcDay(), -1);
  let updated = 0;
  let baselines = 0;
  for (const price of prices) {
    const productId = productIdByPrinting.get(price.printingId);
    if (productId == null) continue;
    const oldAmount = oldTrends.get(productId);
    if (oldAmount == null) continue;
    const current = Number(price.amount.toString());
    if (Math.round(oldAmount * 100) === Math.round(current * 100)) continue;

    await prisma.price.update({
      where: { id: price.id },
      data: { previousAmount: oldAmount },
    });
    updated += 1;

    const existing = await prisma.priceSnapshot.findUnique({
      where: {
        printingId_sourceId_kind_day: {
          printingId: price.printingId,
          sourceId: source.id,
          kind: "trend",
          day: yesterday,
        },
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.priceSnapshot.create({
        data: {
          printingId: price.printingId,
          sourceId: source.id,
          kind: "trend",
          amount: oldAmount,
          currency: "EUR",
          day: yesterday,
        },
      });
      baselines += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        archive,
        priorDay: utcDayKey(yesterday),
        pricesCompared: prices.length,
        withChange: updated,
        snapshotsCreated: baselines,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
