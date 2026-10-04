import assert from "node:assert/strict";
import {
  assignmentCoverage,
  DISTINCT_MARKET_SET_PAIRS,
  findSharedProductClones,
  matchCardmarketPrices,
  parsePriceFile,
  parseProductFile,
  RETAIL_PRICE_PROPAGATION,
} from "../src/lib/cardmarket";
import {
  buildPortfolioHistory,
  buildPrintingHistory,
  extendPortfolioHistory,
  utcDayKey,
} from "../src/lib/price-history";
import {
  aggregateCollection,
  alignReleasedFilters,
  buildInvestmentLines,
  extensionValue,
  computeProgress,
  englishChecklist,
  filterInvestmentLines,
  filterPrintings,
  investmentBySet,
  languageOptions,
  numberMatches,
  ownershipOf,
  parseFilters,
  priceMovement,
  setForLanguage,
  summarizeInvestment,
  viewOwnership,
} from "../src/lib/logic";
import type { CardDTO, CollectionItemDTO, Filters, PrintingDTO } from "../src/lib/types";
import { defaultFilters } from "../src/lib/logic";

function card(partial: Partial<CardDTO> & Pick<CardDTO, "id">): CardDTO {
  return {
    externalId: partial.id,
    slug: partial.id,
    name: partial.name ?? "Carte",
    subname: null,
    canonicalName: partial.canonicalName ?? partial.name ?? "Carte",
    rulesText: partial.rulesText ?? null,
    flavorText: null,
    color: partial.color ?? "Red",
    cardType: partial.cardType ?? "Unit",
    isEddiable: null,
    cost: partial.cost ?? 1,
    power: 1,
    ram: 1,
    tags: partial.tags ?? [],
    keywords: [],
    ...partial,
  };
}

function printing(partial: Partial<PrintingDTO> & Pick<PrintingDTO, "id" | "cardId" | "collectorNumber">): PrintingDTO {
  return {
    externalId: partial.id,
    setCode: partial.setCode ?? "welcometonightcityretail",
    setName: "Welcome to Night City — Retail",
    rarity: partial.rarity ?? "Common",
    language: "en",
    localizedName: null,
    imagePath: null,
    artist: null,
    printedRulesText: null,
    officialFinish: null,
    marketPrice: null,
    previousMarketPrice: null,
    ...partial,
  };
}

function item(partial: Partial<CollectionItemDTO> & Pick<CollectionItemDTO, "printingId" | "quantity">): CollectionItemDTO {
  return {
    id: partial.id ?? partial.printingId,
    conditionCode: partial.conditionCode ?? "NM",
    conditionName: "Near Mint",
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

assert.equal(numberMatches("005a", "5"), true);
assert.equal(numberMatches("005b", "5"), true);
assert.equal(numberMatches("β005a", "5"), true);
assert.equal(numberMatches("015", "5"), false);
assert.equal(numberMatches("050", "5"), false);
assert.equal(numberMatches("005a", "005a"), true);
assert.equal(numberMatches("005a", "5a"), true);
assert.equal(numberMatches("005b", "005a"), false);

const cards = new Map<string, CardDTO>([
  ["a", card({ id: "a", canonicalName: "V — Streetkid", color: "Red", cardType: "Legend", cost: 5, tags: ["Merc"] })],
  ["b", card({ id: "b", canonicalName: "Royce — Psycho", color: "Blue", cardType: "Unit", cost: 2, tags: ["Maelstrom", "Ganger"] })],
]);
const printings = [
  printing({ id: "p1", cardId: "a", collectorNumber: "005a", rarity: "Rare", artist: "Ada" }),
  printing({ id: "p2", cardId: "b", collectorNumber: "015", rarity: "Common", artist: "Bo" }),
];
const filters = (partial: Partial<Filters>): Filters => ({
  ...defaultFilters(),
  set: "welcometonightcityretail",
  language: "en",
  ...partial,
});
const agg = aggregateCollection([
  item({ printingId: "p1", quantity: 3 }),
  item({ id: "p1-lp", printingId: "p1", quantity: 1, conditionCode: "LP" }),
]);

const progress = computeProgress(printings, agg);
assert.equal(progress.uniqueOwned, 1);
assert.equal(progress.totalCopies, 4);
assert.equal(progress.duplicates, 1);
assert.equal(progress.missing, 1);

const owned = filterPrintings(printings, cards, agg, filters({ collection: "owned" }));
assert.deepEqual(owned.map((printing) => printing.id), ["p1"]);
const missing = filterPrintings(printings, cards, agg, filters({ collection: "missing" }));
assert.deepEqual(missing.map((printing) => printing.id), ["p2"]);
const duplicates = filterPrintings(printings, cards, agg, filters({ collection: "duplicates" }));
assert.deepEqual(duplicates.map((printing) => printing.id), ["p1"]);

const colors = filterPrintings(printings, cards, agg, filters({ colors: ["Red", "Blue"] }));
assert.equal(colors.length, 2);
const tags = filterPrintings(printings, cards, agg, filters({ tags: ["Ganger"] }));
assert.deepEqual(tags.map((printing) => printing.id), ["p2"]);
const artists = filterPrintings(printings, cards, agg, filters({ artists: ["Ada"] }));
assert.deepEqual(artists.map((printing) => printing.id), ["p1"]);
const combined = filterPrintings(printings, cards, agg, filters({ colors: ["Red"], rarity: "Rare", collection: "owned" }));
assert.deepEqual(combined.map((printing) => printing.id), ["p1"]);
const search = filterPrintings(printings, cards, agg, filters({ q: "street 5" }));
assert.deepEqual(search.map((printing) => printing.id), ["p1"]);

const mergedCards = new Map([
  ["a", card({ id: "a", canonicalName: "V", color: "Red", cardType: "Unit" })],
]);
const mergedPrintings = [
  printing({ id: "retail", cardId: "a", collectorNumber: "005a", setCode: "welcometonightcityretail" }),
  printing({ id: "beta", cardId: "a", collectorNumber: "β005a", setCode: "welcometonightcitybeta" }),
  printing({ id: "extra", cardId: "a", collectorNumber: "β141", setCode: "welcometonightcitybeta", rarity: "Iconic Legend" }),
  printing({ id: "fr", cardId: "a", collectorNumber: "005a", setCode: "welcometonightcityretail-fr", language: "fr" }),
];
const retailOnly = filterPrintings(
  mergedPrintings,
  mergedCards,
  aggregateCollection([]),
  filters({ set: "welcometonightcityretail", language: "en" }),
);
assert.deepEqual(retailOnly.map((item) => item.id), ["retail"]);
const betaOnly = filterPrintings(
  mergedPrintings,
  mergedCards,
  aggregateCollection([]),
  filters({ set: "welcometonightcitybeta", language: "en" }),
);
assert.deepEqual(betaOnly.map((item) => item.id).sort(), ["beta", "extra"]);
const french = filterPrintings(
  mergedPrintings,
  mergedCards,
  aggregateCollection([]),
  filters({ set: "welcometonightcityretail-fr", language: "fr" }),
);
assert.deepEqual(french.map((item) => item.id), ["fr"]);
const ownedBeta = aggregateCollection([
  item({ id: "beta-line", printingId: "beta", quantity: 1 }),
]);
const ownedRetail = filterPrintings(
  mergedPrintings,
  mergedCards,
  ownedBeta,
  filters({ set: "welcometonightcityretail", language: "en", collection: "owned" }),
);
assert.deepEqual(ownedRetail.map((item) => item.id), []);
const ownedBetaCards = filterPrintings(
  mergedPrintings,
  mergedCards,
  ownedBeta,
  filters({ set: "welcometonightcitybeta", language: "en", collection: "owned" }),
);
assert.deepEqual(ownedBetaCards.map((item) => item.id), ["beta"]);
const ownedFrench = filterPrintings(
  mergedPrintings,
  mergedCards,
  ownedBeta,
  filters({ set: "welcometonightcityretail-fr", language: "fr", collection: "owned" }),
);
assert.deepEqual(ownedFrench.map((item) => item.id), []);

const withPromo = [
  ...mergedPrintings,
  printing({ id: "promo", cardId: "a", collectorNumber: "005a", setCode: "PRM01" }),
];
const promoOwned = aggregateCollection([
  item({ id: "promo-line", printingId: "promo", quantity: 2 }),
]);
const allView = viewOwnership("all", withPromo, promoOwned);
assert.equal(ownershipOf("promo", allView).qty, 2);
assert.equal(ownershipOf("retail", allView).qty, 0);
const betaOwnedAll = viewOwnership("all", withPromo, ownedBeta);
assert.equal(ownershipOf("retail", betaOwnedAll).qty, 0);
assert.equal(ownershipOf("beta", betaOwnedAll).qty, 1);
assert.equal(ownershipOf("promo", betaOwnedAll).qty, 0);
const allSets = filterPrintings(withPromo, mergedCards, betaOwnedAll, filters({ set: "all", language: "" }));
assert.deepEqual(allSets.map((item) => item.id).sort(), ["beta", "extra", "fr", "promo", "retail"]);
const allEnglish = filterPrintings(withPromo, mergedCards, betaOwnedAll, filters({ set: "all", language: "en" }));
assert.deepEqual(allEnglish.map((item) => item.id).sort(), ["beta", "extra", "promo", "retail"]);

const current = filters({ set: "welcometonightcityretail", language: "en" });
const selectedAll = alignReleasedFilters({ ...current, set: "all" }, { set: "all" });
assert.equal(selectedAll.set, "all");
assert.equal(selectedAll.language, "");
const parsedAll = parseFilters(new URLSearchParams("set=all"));
assert.equal(parsedAll.set, "all");
assert.equal(parsedAll.language, "");
const legacyRetail = alignReleasedFilters(filters({ set: "wtmc", language: "en" }));
assert.equal(legacyRetail.set, "wtmc-en");
assert.equal(legacyRetail.language, "en");
const legacyFrenchCombined = alignReleasedFilters(filters({ set: "wtmc", language: "fr" }));
assert.equal(legacyFrenchCombined.set, "welcometonightcityretail-fr");
assert.equal(legacyFrenchCombined.language, "fr");
const legacyFrench = alignReleasedFilters(filters({ set: "wtmc-fr", language: "en" }));
assert.equal(legacyFrench.set, "welcometonightcityretail-fr");
assert.equal(legacyFrench.language, "fr");
const selectedBeta = alignReleasedFilters(filters({ set: "welcometonightcitybeta", language: "fr" }));
assert.equal(selectedBeta.set, "welcometonightcitybeta");
assert.equal(selectedBeta.language, "en");
const parsedLegacy = parseFilters(new URLSearchParams("set=wtmc"));
assert.equal(parsedLegacy.set, "wtmc-en");
assert.equal(parsedLegacy.language, "en");
assert.equal(defaultFilters().set, "welcometonightcitybeta");
assert.equal(defaultFilters().language, "en");

const englishList = englishChecklist(mergedPrintings);
assert.deepEqual(englishList.map((item) => item.id).sort(), ["extra", "retail"]);
const englishOwned = viewOwnership("wtmc-en", mergedPrintings, ownedBeta);
assert.equal(ownershipOf("retail", englishOwned).qty, 1);
assert.equal(ownershipOf("extra", englishOwned).qty, 0);
const englishProgress = computeProgress(englishList, englishOwned);
assert.equal(englishProgress.uniqueOwned, 1);
assert.equal(englishProgress.total, 2);
assert.equal(englishProgress.missing, 1);
const englishMissing = filterPrintings(
  mergedPrintings,
  mergedCards,
  englishOwned,
  filters({ set: "wtmc-en", language: "en", collection: "missing" }),
);
assert.deepEqual(englishMissing.map((item) => item.id), ["extra"]);
const promoOnly = aggregateCollection([
  item({ id: "promo-only", printingId: "promo", quantity: 2 }),
]);
assert.equal(ownershipOf("retail", viewOwnership("wtmc-en", withPromo, promoOnly)).qty, 0);
const parsedEnglish = parseFilters(new URLSearchParams("set=wtmc-en"));
assert.equal(parsedEnglish.set, "wtmc-en");
assert.equal(parsedEnglish.language, "en");
const alignedEnglish = alignReleasedFilters(filters({ set: "wtmc-en", language: "fr" }));
assert.equal(alignedEnglish.set, "wtmc-en");
assert.equal(alignedEnglish.language, "en");
assert.equal(setForLanguage("welcometonightcitybeta", "fr", mergedPrintings), "welcometonightcityretail-fr");
assert.equal(setForLanguage("welcometonightcityretail-fr", "en", mergedPrintings), "welcometonightcityretail");
assert.equal(extensionValue("welcometonightcitybeta"), "welcometonightcitybeta");
assert.equal(extensionValue("welcometonightcityretail"), "welcometonightcityretail");
assert.equal(extensionValue("welcometonightcityretail-fr"), "welcometonightcityretail");
assert.deepEqual(languageOptions("welcometonightcitybeta", mergedPrintings, ["en"]), ["en", "fr"]);
assert.deepEqual(languageOptions("welcometonightcityretail-fr", mergedPrintings, ["fr"]), ["en", "fr"]);

const catalogText = JSON.stringify({
  products: [
    { idProduct: 1, name: "Adam Smasher - Ender of Legends (V.1)", idExpansion: 10, number: "001" },
    { idProduct: 2, name: "Judy Álvarez - Nothing to Doubt (V.1)", idExpansion: 10, number: "116" },
    { idProduct: 3, name: "Judy Álvarez - Nothing to Doubt (V.2)", idExpansion: 10, number: "171" },
    { idProduct: 4, name: "Dying Night - V's Pistol", expansionName: "The Heist - Demo Deck", number: "013" },
    { idProduct: 5, name: "Adam Smasher - Ender of Legends (V.1)", expansionName: "Welcome to Night City - Retail", number: "001" },
    { idProduct: 6, name: "Take Control", idExpansion: 10 },
    { idProduct: 7, name: "Jackie Welles - Ride or Die Choom", expansionName: "Alpha" },
  ],
});
const priceText = [
  "idProduct,Avg. Sell Price,Low Price,Trend Price",
  "1,3.50,2.00,4.00",
  "2,1.00,0.80,1.20",
  "3,7.00,6.00,8.00",
  "4,0.40,0.20,0.50",
  "5,9.00,8.00,9.00",
  "6,0.10,0.05,0.15",
  "7,2.00,1.00,3.00",
  "8,1.00,1.00,0",
].join("\n");
const parsedProducts = parseProductFile(catalogText);
const parsedTrends = parsePriceFile(priceText);
assert.equal(parsedProducts.length, 7);
assert.equal(parsedTrends.get(1), 4);
assert.equal(parsedTrends.get(8), 1);
const matched = matchCardmarketPrices(
  parsedProducts,
  parsedTrends,
  [
    { code: "welcometonightcitybeta", name: "Welcome to Night City — Beta" },
    { code: "welcometonightcityretail", name: "Welcome to Night City — Retail" },
    { code: "welcometonightcityretail-fr", name: "Welcome to Night City — Retail — FR" },
    { code: "mercdemodeck", name: "Merc Demo Deck" },
    { code: "theheistbetastarterdeck", name: "The Heist — Beta Starter Deck" },
  ],
  [
    { id: "b1", setCode: "welcometonightcitybeta", collectorNumber: "β001", name: "Adam Smasher — Ender of Legends" },
    { id: "r1", setCode: "welcometonightcityretail", collectorNumber: "001", name: "Adam Smasher — Ender of Legends" },
    { id: "f1", setCode: "welcometonightcityretail-fr", collectorNumber: "001", name: "Adam Smasher — Ender of Legends" },
    { id: "j1", setCode: "welcometonightcitybeta", collectorNumber: "β116", name: "Judy Álvarez — Nothing to Doubt" },
    { id: "j2", setCode: "welcometonightcitybeta", collectorNumber: "β171", name: "Judy Álvarez — Nothing to Doubt" },
    { id: "t1", setCode: "welcometonightcitybeta", collectorNumber: "β103", name: "Take Control" },
    { id: "m1", setCode: "mercdemodeck", collectorNumber: "013", name: "Dying Night — V's Pistol" },
    { id: "h1", setCode: "theheistbetastarterdeck", collectorNumber: "β017", name: "Dying Night — V's Pistol" },
  ],
);
const priceOf = (id: string) => matched.assignments.find((assignment) => assignment.printingId === id)?.amount ?? null;
assert.equal(priceOf("b1"), "4.00");
assert.equal(priceOf("r1"), "9.00");
assert.equal(priceOf("f1"), null);
assert.equal(priceOf("j1"), "1.20");
assert.equal(priceOf("j2"), "8.00");
assert.equal(priceOf("t1"), "0.15");
assert.equal(priceOf("m1"), "0.50");
assert.equal(priceOf("h1"), null);
assert.equal(matched.unknownExpansions.includes("Alpha"), true);
assert.deepEqual(
  findSharedProductClones(matched.assignments, [
    { id: "b1", setCode: "welcometonightcitybeta", collectorNumber: "β001", name: "Adam Smasher — Ender of Legends" },
    { id: "r1", setCode: "welcometonightcityretail", collectorNumber: "001", name: "Adam Smasher — Ender of Legends" },
    { id: "f1", setCode: "welcometonightcityretail-fr", collectorNumber: "001", name: "Adam Smasher — Ender of Legends" },
  ]),
  [],
);

const betaToRetail = matchCardmarketPrices(
  [{ idProduct: 20, name: "Take Control", idExpansion: 99, expansionName: null, number: "103" }],
  new Map([[20, 0.11]]),
  [
    { code: "welcometonightcitybeta", name: "Welcome to Night City — Beta" },
    { code: "welcometonightcityretail", name: "Welcome to Night City — Retail" },
    { code: "welcometonightcityretail-fr", name: "Welcome to Night City — Retail — FR" },
  ],
  [
    { id: "beta-tc", setCode: "welcometonightcitybeta", collectorNumber: "β103", name: "Take Control" },
    { id: "retail-tc", setCode: "welcometonightcityretail", collectorNumber: "103", name: "Take Control" },
    { id: "fr-tc", setCode: "welcometonightcityretail-fr", collectorNumber: "103", name: "Take Control" },
  ],
);
assert.equal(betaToRetail.assignments.find((assignment) => assignment.printingId === "beta-tc")?.amount, "0.11");
assert.equal(betaToRetail.assignments.find((assignment) => assignment.printingId === "retail-tc"), undefined);
assert.equal(betaToRetail.assignments.find((assignment) => assignment.printingId === "fr-tc"), undefined);

const ambiguous = matchCardmarketPrices(
  [
    { idProduct: 8, name: "Judy Álvarez - Nothing to Doubt (V.1)", idExpansion: 10, expansionName: null, number: null },
    { idProduct: 9, name: "Judy Álvarez - Nothing to Doubt (V.2)", idExpansion: 10, expansionName: null, number: null },
  ],
  new Map([
    [8, 1],
    [9, 8],
  ]),
  [{ code: "welcometonightcitybeta", name: "Welcome to Night City — Beta" }],
  [
    { id: "j1", setCode: "welcometonightcitybeta", collectorNumber: "β116", name: "Judy Álvarez — Nothing to Doubt" },
    { id: "j2", setCode: "welcometonightcitybeta", collectorNumber: "β171", name: "Judy Álvarez — Nothing to Doubt" },
  ],
);
assert.equal(ambiguous.assignments.length, 2);
assert.equal(ambiguous.assignments.find((assignment) => assignment.printingId === "j1")?.amount, "1.00");
assert.equal(ambiguous.assignments.find((assignment) => assignment.printingId === "j2")?.amount, "8.00");
assert.equal(ambiguous.ambiguousProducts, 0);

const betaTwin = matchCardmarketPrices(
  [{ idProduct: 10, name: "Minotaur", idExpansion: 1, expansionName: null, number: "001" }],
  new Map([[10, 2]]),
  [
    { code: "boxtoppersbeta", name: "Box Toppers — Beta" },
    { code: "boxtoppersretail", name: "Box Toppers — Retail" },
  ],
  [
    { id: "bb", setCode: "boxtoppersbeta", collectorNumber: "β001", name: "Minotaur" },
    { id: "br", setCode: "boxtoppersretail", collectorNumber: "001", name: "Minotaur" },
  ],
);
assert.equal(betaTwin.assignments.find((assignment) => assignment.printingId === "bb")?.amount, "2.00");
assert.equal(betaTwin.assignments.find((assignment) => assignment.printingId === "br"), undefined);
assert.deepEqual(
  findSharedProductClones(betaTwin.assignments, [
    { id: "bb", setCode: "boxtoppersbeta", collectorNumber: "β001", name: "Minotaur" },
    { id: "br", setCode: "boxtoppersretail", collectorNumber: "001", name: "Minotaur" },
  ]),
  [],
);

const bothTwins = matchCardmarketPrices(
  [
    { idProduct: 11, name: "Minotaur", idExpansion: 1, expansionName: null, number: "001" },
    { idProduct: 12, name: "Minotaur", idExpansion: 2, expansionName: null, number: "001" },
  ],
  new Map([
    [11, 2],
    [12, 3],
  ]),
  [
    { code: "boxtoppersbeta", name: "Box Toppers — Beta" },
    { code: "boxtoppersretail", name: "Box Toppers — Retail" },
  ],
  [
    { id: "bb", setCode: "boxtoppersbeta", collectorNumber: "β001", name: "Minotaur" },
    { id: "br", setCode: "boxtoppersretail", collectorNumber: "001", name: "Minotaur" },
  ],
);
assert.equal(bothTwins.assignments.find((assignment) => assignment.printingId === "bb")?.amount, "2.00");
assert.equal(bothTwins.assignments.find((assignment) => assignment.printingId === "br")?.amount, "3.00");
assert.notEqual(
  bothTwins.assignments.find((assignment) => assignment.printingId === "bb")?.productId,
  bothTwins.assignments.find((assignment) => assignment.printingId === "br")?.productId,
);
assert.deepEqual(
  findSharedProductClones(bothTwins.assignments, [
    { id: "bb", setCode: "boxtoppersbeta", collectorNumber: "β001", name: "Minotaur" },
    { id: "br", setCode: "boxtoppersretail", collectorNumber: "001", name: "Minotaur" },
  ]),
  [],
);

const counted = matchCardmarketPrices(
  [
    { idProduct: 13, name: "Minotaur", idExpansion: 3, expansionName: null, number: "001" },
    { idProduct: 14, name: "Minotaur", idExpansion: 3, expansionName: null, number: "002" },
    { idProduct: 15, name: "Minotaur", idExpansion: 4, expansionName: null, number: "001" },
  ],
  new Map([
    [13, 4],
    [14, 5],
    [15, 6],
  ]),
  [
    { code: "boxtoppersbeta", name: "Box Toppers — Beta" },
    { code: "boxtoppersretail", name: "Box Toppers — Retail" },
  ],
  [
    { id: "b1", setCode: "boxtoppersbeta", collectorNumber: "β001", name: "Minotaur" },
    { id: "b2", setCode: "boxtoppersbeta", collectorNumber: "β002", name: "Minotaur" },
    { id: "r1b", setCode: "boxtoppersretail", collectorNumber: "001", name: "Minotaur" },
  ],
);
assert.equal(counted.assignments.find((assignment) => assignment.printingId === "b1")?.amount, "4.00");
assert.equal(counted.assignments.find((assignment) => assignment.printingId === "b2")?.amount, "5.00");
assert.equal(counted.assignments.find((assignment) => assignment.printingId === "r1b")?.amount, "6.00");

// Policy: no beta→retail or language price propagation allow-list.
assert.deepEqual(Object.keys(RETAIL_PRICE_PROPAGATION), []);
for (const [beta, retail] of DISTINCT_MARKET_SET_PAIRS) {
  assert.equal(RETAIL_PRICE_PROPAGATION[beta], undefined);
  assert.ok(beta && retail);
}

// Detector must catch a synthetic shared productId clone across beta/retail and languages.
const detected = findSharedProductClones(
  [
    { printingId: "bb", amount: "2.00", productId: 10 },
    { printingId: "br", amount: "2.00", productId: 10 },
  ],
  [
    { id: "bb", setCode: "boxtoppersbeta", collectorNumber: "β001", name: "Minotaur" },
    { id: "br", setCode: "boxtoppersretail", collectorNumber: "001", name: "Minotaur" },
  ],
);
assert.equal(detected.length, 1);
assert.equal(detected[0]?.productId, 10);
assert.equal(detected[0]?.name, "Minotaur");

const languageClone = findSharedProductClones(
  [
    { printingId: "en", amount: "9.00", productId: 5 },
    { printingId: "fr", amount: "9.00", productId: 5 },
  ],
  [
    { id: "en", setCode: "welcometonightcityretail", collectorNumber: "001", name: "Adam Smasher — Ender of Legends" },
    { id: "fr", setCode: "welcometonightcityretail-fr", collectorNumber: "001", name: "Adam Smasher — Ender of Legends" },
  ],
);
assert.equal(languageClone.length, 1);
assert.equal(languageClone[0]?.rightSetCode, "welcometonightcityretail-fr");

// Coverage helper: one Cardmarket productId → one printing (no clone inflation).
const cleanCoverage = assignmentCoverage(matched.assignments);
assert.equal(cleanCoverage.cloneExtra, 0);
assert.equal(cleanCoverage.assignments, cleanCoverage.uniqueProducts);
assert.equal(cleanCoverage.assignments, matched.matchedProducts);
assert.deepEqual(cleanCoverage.reusedProductIds, []);
for (const assignment of matched.assignments) {
  assert.equal(assignment.amount, parsedTrends.get(assignment.productId)?.toFixed(2));
}

const inflated = assignmentCoverage([
  { printingId: "a", amount: "1.00", productId: 1 },
  { printingId: "b", amount: "1.00", productId: 1 },
  { printingId: "c", amount: "2.00", productId: 2 },
]);
assert.equal(inflated.assignments, 3);
assert.equal(inflated.uniqueProducts, 2);
assert.equal(inflated.cloneExtra, 1);
assert.deepEqual(inflated.reusedProductIds, [1]);

assert.equal(priceMovement(2, 1), "up");
assert.equal(priceMovement(1, 2), "down");
assert.equal(priceMovement(1, 1), "flat");
assert.equal(priceMovement(1, null), "none");

const investCard = card({ id: "c-invest", name: "Invest Unit" });
const investPrinting = printing({
  id: "p-invest",
  cardId: investCard.id,
  collectorNumber: "010",
  setCode: "welcometonightcityretail",
  setName: "Welcome to Night City — Retail",
  marketPrice: "5.00",
  previousMarketPrice: "4.00",
});
const investLines = buildInvestmentLines(
  [
    item({
      id: "i1",
      printingId: investPrinting.id,
      quantity: 2,
      purchasePrice: "3.00",
      purchaseCurrency: "EUR",
    }),
    item({
      id: "i2",
      printingId: investPrinting.id,
      quantity: 1,
      conditionCode: "LP",
    }),
  ],
  [investPrinting],
  new Map([[investCard.id, investCard]]),
);
assert.equal(investLines.length, 2);
assert.equal(investLines[0].profit, 4);
assert.equal(investLines[0].marketDelta, "up");
assert.equal(investLines[1].profit, null);
const investSummary = summarizeInvestment(investLines);
assert.equal(investSummary.marketTotal, 15);
assert.equal(investSummary.investedEur, 6);
assert.equal(investSummary.profitEur, 4);
assert.equal(investSummary.marketDelta, "up");
const bySet = investmentBySet(investLines, [
  { code: "welcometonightcityretail", name: "Welcome to Night City — Retail", number: 1, releaseDate: null, logoUrl: null, description: null, cardCount: 1, status: "released", sortOrder: 1 },
]);
assert.equal(bySet.length, 1);
assert.equal(bySet[0].marketTotal, 15);
assert.equal(bySet[0].marketDelta, "up");
assert.equal(bySet[0].marketDeltaAmount, 3);

const mixedPrintingChanged = printing({
  id: "p-mixed-changed",
  cardId: investCard.id,
  collectorNumber: "011",
  setCode: "welcometonightcitybeta",
  setName: "Welcome to Night City — Beta",
  marketPrice: "13.00",
  previousMarketPrice: "11.00",
});
const mixedPrintingFlat = printing({
  id: "p-mixed-flat",
  cardId: investCard.id,
  collectorNumber: "012",
  setCode: "welcometonightcitybeta",
  setName: "Welcome to Night City — Beta",
  marketPrice: "100.00",
  previousMarketPrice: null,
});
const mixedLines = buildInvestmentLines(
  [
    item({ id: "im1", printingId: mixedPrintingChanged.id, quantity: 1 }),
    item({ id: "im2", printingId: mixedPrintingFlat.id, quantity: 1 }),
  ],
  [mixedPrintingChanged, mixedPrintingFlat],
  new Map([[investCard.id, investCard]]),
);
const mixedBySet = investmentBySet(mixedLines, [
  {
    code: "welcometonightcitybeta",
    name: "Welcome to Night City — Beta",
    number: 2,
    releaseDate: null,
    logoUrl: null,
    description: null,
    cardCount: 2,
    status: "released",
    sortOrder: 2,
  },
]);
assert.equal(mixedBySet[0].marketTotal, 113);
assert.equal(mixedBySet[0].marketDeltaAmount, 2);
assert.equal(mixedBySet[0].marketDelta, "up");
assert.equal(filterInvestmentLines(investLines, { set: "all", language: "", performance: "profit", q: "" }).length, 1);
assert.equal(filterInvestmentLines(investLines, { set: "all", language: "", performance: "unknown", q: "" }).length, 1);
assert.equal(filterInvestmentLines(investLines, { set: "all", language: "", performance: "rising", q: "" }).length, 2);

assert.equal(utcDayKey("2026-09-28T15:00:00.000Z"), "2026-09-28");
const portfolio = buildPortfolioHistory(
  [
    { printingId: "a", quantity: 2 },
    { printingId: "b", quantity: 1 },
  ],
  [
    { printingId: "a", day: "2026-09-26", amount: 1 },
    { printingId: "b", day: "2026-09-26", amount: 4 },
    { printingId: "a", day: "2026-09-28", amount: 1.5 },
  ],
);
assert.deepEqual(portfolio, [
  { day: "2026-09-26", marketTotal: 6, pricedCopies: 3 },
  { day: "2026-09-28", marketTotal: 7, pricedCopies: 3 },
]);
assert.deepEqual(
  buildPrintingHistory([
    { printingId: "a", day: "2026-09-28", amount: 2 },
    { printingId: "a", day: "2026-09-26", amount: 1 },
  ]),
  [
    { day: "2026-09-26", amount: 1 },
    { day: "2026-09-28", amount: 2 },
  ],
);

// Reprise d'une courbe : couper l'historique à n'importe quel jour puis prolonger
// doit donner exactement la courbe complète (base du cache PortfolioHistoryCache).
{
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let round = 0; round < 200; round += 1) {
    const printingIds = ["a", "b", "c", "d", "e"].slice(0, 1 + Math.floor(random() * 5));
    const owned = printingIds.map((printingId) => ({ printingId, quantity: Math.floor(random() * 4) }));
    const days = Array.from({ length: 12 }, (_, index) => `2026-09-${String(index + 10).padStart(2, "0")}`);
    const snapshots = days.flatMap((day) =>
      printingIds
        .filter(() => random() < 0.5)
        .map((printingId) => ({ printingId, day, amount: random() < 0.1 ? 0 : Math.round(random() * 1000) / 100 })),
    );
    // Un snapshot d'une carte non possédée ne doit rien changer.
    snapshots.push({ printingId: "zz", day: days[3], amount: 99 });
    const full = buildPortfolioHistory(owned, snapshots);
    for (const split of ["2026-09-01", ...days]) {
      const head = extendPortfolioHistory(owned, new Map(), snapshots.filter((row) => row.day <= split));
      const tail = extendPortfolioHistory(owned, head.lastPrice, snapshots.filter((row) => row.day > split));
      assert.deepEqual([...head.points, ...tail.points], full, `reprise au ${split} (tour ${round})`);
      // La reprise depuis un état sérialisé en JSON (comme en base) donne le même résultat.
      const restored = new Map<string, number>(Object.entries(JSON.parse(JSON.stringify(Object.fromEntries(head.lastPrice)))));
      const tailFromJson = extendPortfolioHistory(owned, restored, snapshots.filter((row) => row.day > split));
      assert.deepEqual(tailFromJson.points, tail.points);
    }
    // L'état d'entrée n'est jamais modifié.
    const start = new Map([["a", 1]]);
    extendPortfolioHistory(owned, start, snapshots);
    assert.deepEqual([...start], [["a", 1]]);
  }
}

console.log("verify-logic ok");
