import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assignmentCoverage,
  DISTINCT_MARKET_SET_PAIRS,
  findSharedProductClones,
  languageMarketSetPairs,
  matchCardmarketPrices,
  parsePriceFile,
  parseProductFile,
  RETAIL_PRICE_PROPAGATION,
  type LocalPrinting,
} from "../src/lib/cardmarket";
import { prisma } from "../src/lib/prisma";

const CACHE = path.join(process.cwd(), "data", "cardmarket");

async function main() {
  assert.deepEqual(Object.keys(RETAIL_PRICE_PROPAGATION), []);

  const products = parseProductFile(readFileSync(path.join(CACHE, "products_singles_23.json"), "utf8"));
  const trends = parsePriceFile(readFileSync(path.join(CACHE, "price_guide_23.json"), "utf8"));
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
  const locals: LocalPrinting[] = printings.map((printing) => ({
    id: printing.id,
    setCode: printing.set.code,
    collectorNumber: printing.collectorNumber,
    name: printing.card.canonicalName,
  }));
  const report = matchCardmarketPrices(products, trends, sets, locals);
  const languagePairs = languageMarketSetPairs(locals.map((printing) => printing.setCode));
  assert.ok(languagePairs.length > 0, "expected at least one EN/FR set twin in the catalog");

  const catalogProductIds = new Set(products.map((product) => product.idProduct));
  let guidePricesInCatalog = 0;
  for (const productId of trends.keys()) {
    if (catalogProductIds.has(productId)) guidePricesInCatalog += 1;
  }
  assert.equal(
    guidePricesInCatalog,
    report.pricedProducts,
    "pricedProducts must equal Cardmarket guide rows that exist in the singles catalog",
  );
  assert.equal(
    products.filter((product) => trends.has(product.idProduct)).length,
    report.pricedProducts,
  );

  const coverage = assignmentCoverage(report.assignments);
  assert.equal(
    coverage.cloneExtra,
    0,
    `cloned Cardmarket productIds detected: ${coverage.reusedProductIds.join(", ")}`,
  );
  assert.equal(
    coverage.assignments,
    coverage.uniqueProducts,
    "each assigned price must come from a distinct Cardmarket productId (no cloning)",
  );
  assert.equal(coverage.assignments, coverage.uniquePrintings, "one price row per printing");
  assert.equal(
    coverage.assignments,
    report.matchedProducts,
    "matchedProducts must equal written assignments when cloning is disabled",
  );
  assert.ok(
    coverage.uniqueProducts <= report.pricedProducts,
    "cannot assign more unique products than the price guide provides for this catalog",
  );
  assert.ok(
    coverage.uniqueProducts + report.unknownExpansionProducts <= report.pricedProducts,
    "assigned + unknown-expansion guide rows cannot exceed the catalog guide total",
  );

  // Every written assignment must come from the guide with the same trend amount.
  for (const assignment of report.assignments) {
    const trend = trends.get(assignment.productId);
    assert.ok(trend != null, `assignment productId ${assignment.productId} missing from price guide`);
    assert.equal(
      assignment.amount,
      trend.toFixed(2),
      `amount drift for productId ${assignment.productId}`,
    );
  }

  const forbidden = findSharedProductClones(report.assignments, locals);
  assert.equal(
    forbidden.length,
    0,
    `forbidden shared Cardmarket productIds: ${forbidden
      .map((row) => `${row.name} ${row.leftSetCode}/${row.rightSetCode}#${row.productId}`)
      .join("; ")}`,
  );

  const byId = new Map(report.assignments.map((row) => [row.printingId, row]));
  const pricedBySet = new Map<string, number>();
  for (const printing of locals) {
    if (!byId.has(printing.id)) continue;
    pricedBySet.set(printing.setCode, (pricedBySet.get(printing.setCode) ?? 0) + 1);
  }

  assert.ok((pricedBySet.get("welcometonightcitybeta") ?? 0) > 0);
  assert.ok((pricedBySet.get("boxtoppersbeta") ?? 0) > 0);
  for (const [beta, retail] of DISTINCT_MARKET_SET_PAIRS) {
    const shared = findSharedProductClones(report.assignments, locals, [[beta, retail]]);
    assert.equal(shared.length, 0, `${beta}/${retail} still share productIds`);
  }
  for (const [en, fr] of languagePairs) {
    const shared = findSharedProductClones(report.assignments, locals, [[en, fr]]);
    assert.equal(shared.length, 0, `${en}/${fr} language twins must not share productIds`);
  }

  // DB must mirror the match output: singles prices == assignments, no clone leftovers.
  const sealedPrintings = await prisma.printing.findMany({
    where: { externalId: { startsWith: "cardmarket:" } },
    select: { id: true },
  });
  const sealedIds = new Set(sealedPrintings.map((row) => row.id));
  const dbPrices = await prisma.price.findMany({
    where: { kind: "trend", source: { code: "cardmarket" } },
    select: { printingId: true, amount: true },
  });
  const dbSingles = dbPrices.filter((row) => !sealedIds.has(row.printingId));
  const dbSealed = dbPrices.filter((row) => sealedIds.has(row.printingId));
  assert.equal(
    dbSingles.length,
    coverage.assignments,
    `DB singles prices (${dbSingles.length}) must equal matched assignments (${coverage.assignments}) — cloning or missed imports`,
  );
  assert.equal(
    new Set(dbSingles.map((row) => row.printingId)).size,
    dbSingles.length,
    "DB must not store duplicate prices for the same singles printing",
  );

  for (const row of dbSingles) {
    const expected = byId.get(row.printingId);
    assert.ok(expected, `DB price without match assignment for printing ${row.printingId}`);
    assert.equal(Number(row.amount.toString()), Number(expected.amount));
  }

  // Unmatched distinct-market / language printings must not keep orphan prices or snapshots.
  for (const setCode of new Set([
    ...DISTINCT_MARKET_SET_PAIRS.flatMap(([beta, retail]) => [beta, retail]),
    ...languagePairs.flatMap(([en, fr]) => [en, fr]),
  ])) {
    const matchedIds = new Set(
      locals.filter((printing) => printing.setCode === setCode && byId.has(printing.id)).map((printing) => printing.id),
    );
    const rows = await prisma.printing.findMany({
      where: { set: { code: setCode }, isActive: true },
      select: {
        id: true,
        collectorNumber: true,
        card: { select: { canonicalName: true } },
        prices: { where: { kind: "trend", source: { code: "cardmarket" } }, select: { id: true } },
        snapshots: { where: { kind: "trend", source: { code: "cardmarket" } }, select: { id: true } },
      },
    });
    for (const row of rows) {
      if (matchedIds.has(row.id)) continue;
      assert.equal(
        row.prices.length,
        0,
        `DB price leak on unmatched ${setCode} ${row.collectorNumber} ${row.card.canonicalName}`,
      );
      assert.equal(
        row.snapshots.length,
        0,
        `DB snapshot leak on unmatched ${setCode} ${row.collectorNumber} ${row.card.canonicalName}`,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        guidePricesInCatalog,
        pricedProducts: report.pricedProducts,
        matchedProducts: report.matchedProducts,
        ambiguousProducts: report.ambiguousProducts,
        unknownExpansionProducts: report.unknownExpansionProducts,
        coverage,
        dbSingles: dbSingles.length,
        dbSealed: dbSealed.length,
        pricedBySet: Object.fromEntries([...pricedBySet.entries()].sort()),
        distinctPairs: DISTINCT_MARKET_SET_PAIRS,
        languagePairs,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
