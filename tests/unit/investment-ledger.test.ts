// Ventes et plus-value réalisée, alertes de revente, conversion des devises (taux BCE), hausses / baisses
// et concentration de la page Investissement : fonctions pures, sans base de données.
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { describe, it } from "vitest";
import { parseEcbRates, pickRate, syncExchangeRates } from "../../src/lib/exchange-rates";
import {
  buildInvestmentLines,
  buildSaleLines,
  filterSaleLines,
  groupInvestmentPositions,
  investmentRateKeys,
  parseRateKey,
  purchaseRateDay,
  rateKey,
  sellTargetReached,
  summarizeInvestment,
  summarizeSales,
  toEur,
  topMovers,
  valueConcentration,
  type InvestmentPosition,
} from "../../src/lib/logic";
import { buildPortfolioHistory } from "../../src/lib/price-history";
import type { CardDTO, CollectionItemDTO, PrintingDTO, SaleDTO } from "../../src/lib/types";

function card(id: string, name = id): CardDTO {
  return {
    id,
    externalId: id,
    slug: id,
    name,
    subname: null,
    canonicalName: name,
    rulesText: null,
    flavorText: null,
    color: "Red",
    cardType: "Unit",
    isEddiable: null,
    cost: 1,
    power: 1,
    ram: 1,
    tags: [],
    keywords: [],
  };
}

function printing(partial: Partial<PrintingDTO> & Pick<PrintingDTO, "id">): PrintingDTO {
  return {
    cardId: partial.id,
    collectorNumber: "001",
    externalId: partial.id,
    setCode: "alpha",
    setName: "Alpha",
    rarity: "Common",
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

function item(partial: Partial<CollectionItemDTO> & Pick<CollectionItemDTO, "id" | "printingId">): CollectionItemDTO {
  return {
    quantity: 1,
    conditionCode: "NM",
    conditionName: "Near Mint",
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    purchasedAt: null,
    addedAt: "2026-01-10T12:00:00.000Z",
    ...partial,
  };
}

function sale(partial: Partial<SaleDTO> & Pick<SaleDTO, "id" | "printingId">): SaleDTO {
  return {
    conditionCode: "NM",
    quantity: 1,
    purchasePrice: null,
    purchaseCurrency: null,
    purchasedAt: null,
    notes: null,
    addedAt: "2026-01-10T12:00:00.000Z",
    salePrice: "10.00",
    saleCurrency: "EUR",
    fees: "0.00",
    soldAt: "2026-03-01",
    ...partial,
  };
}

function position(printingId: string, partial: Partial<InvestmentPosition> = {}): InvestmentPosition {
  return {
    printingId,
    cardId: printingId,
    title: printingId,
    setCode: "alpha",
    setName: "Alpha",
    collectorNumber: "1",
    language: "en",
    rarity: null,
    imagePath: null,
    quantity: 1,
    conditionCodes: ["NM"],
    marketUnit: null,
    previousMarketUnit: null,
    marketTotal: null,
    marketDelta: "none",
    purchaseTotal: null,
    purchaseCurrency: null,
    purchaseUnit: null,
    costEur: null,
    profit: null,
    profitBasis: null,
    profitQuantity: 0,
    lines: [],
    ...partial,
  };
}

const cards = new Map([
  ["c1", card("c1", "Alpha One")],
  ["c2", card("c2", "Bravo Two")],
]);
const printings = [
  printing({ id: "p1", cardId: "c1", marketPrice: "20", previousMarketPrice: "20" }),
  printing({ id: "p2", cardId: "c2", setCode: "beta", setName: "Beta", language: "fr", marketPrice: "5" }),
];

describe("taux de change BCE", () => {
  it("parseEcbRates : guillemets simples ou doubles, devises retenues seulement, taux invalides écartés", () => {
    const xml = `<Cube><Cube time='2026-10-27'><Cube currency='USD' rate='1.1150'/><Cube currency='JPY' rate='175.97'/>
      <Cube currency='GBP' rate='0.83658'/></Cube><Cube time="2026-10-24"><Cube currency="USD" rate="1.109"/>
      <Cube currency="GBP" rate="0"/></Cube></Cube>`;
    assert.deepEqual(parseEcbRates(xml), [
      { currency: "USD", day: "2026-10-27", rate: 1.115 },
      { currency: "GBP", day: "2026-10-27", rate: 0.83658 },
      { currency: "USD", day: "2026-10-24", rate: 1.109 },
    ]);
    assert.deepEqual(parseEcbRates(xml, ["JPY"]), [{ currency: "JPY", day: "2026-10-27", rate: 175.97 }]);
  });

  it("pickRate : taux du jour, sinon le dernier avant, sinon le premier connu", () => {
    const series = [
      { day: "2026-01-02", rate: 1.1 },
      { day: "2026-01-05", rate: 1.2 },
      { day: "2026-01-06", rate: 1.3 },
    ];
    assert.equal(pickRate(series, "2026-01-05"), 1.2);
    assert.equal(pickRate(series, "2026-01-04"), 1.1, "week-end : taux du vendredi");
    assert.equal(pickRate(series, "2026-03-01"), 1.3, "après le dernier taux : le dernier");
    assert.equal(pickRate(series, "2025-12-31"), 1.1, "avant le premier taux : le premier");
    assert.equal(pickRate([], "2026-01-05"), null);
  });

  it("rateKey, toEur et purchaseRateDay", () => {
    assert.equal(rateKey("USD", "2026-01-05"), "USD:2026-01-05");
    assert.deepEqual(parseRateKey("GBP:2026-01-05"), { currency: "GBP", day: "2026-01-05" });
    assert.equal(parseRateKey("usd:2026-01-05"), null);
    const rates = { "USD:2026-01-05": 1.25 };
    assert.equal(toEur(10, "EUR", "2026-01-05", rates), 10);
    assert.equal(toEur(10, null, "2026-01-05", rates), 10, "sans devise : euros");
    assert.equal(toEur(10, "USD", "2026-01-05", rates), 8);
    assert.equal(toEur(10, "USD", "2026-01-06", rates), null, "taux manquant");
    assert.equal(purchaseRateDay({ purchasedAt: "2025-12-24", addedAt: "2026-01-10T12:00:00.000Z" }), "2025-12-24");
    assert.equal(purchaseRateDay({ purchasedAt: null, addedAt: "2026-01-10T12:00:00.000Z" }), "2026-01-10");
  });

  it("syncExchangeRates : base vide → historique complet ; sinon 90 jours, seuls les nouveaux jours écrits", async () => {
    const written: { currency: string; day: Date; rate: string }[] = [];
    const fakeClient = (latest: { currency: string; _max: { day: Date | null } }[]) =>
      ({
        exchangeRate: {
          groupBy: async () => latest,
          createMany: async ({ data }: { data: typeof written }) => {
            written.push(...data);
            return { count: data.length };
          },
        },
      }) as unknown as PrismaClient;
    const urls: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const fetchStub = (async (url: string) => {
      urls.push(url);
      return new Response(
        `<Cube time="${today}"><Cube currency="USD" rate="1.2"/><Cube currency="GBP" rate="0.8"/></Cube>` +
          `<Cube time="2026-01-02"><Cube currency="USD" rate="1.1"/><Cube currency="GBP" rate="0.85"/></Cube>`,
      );
    }) as typeof fetch;

    const full = await syncExchangeRates(fakeClient([]), { fetch: fetchStub });
    assert.equal(full.file, "eurofxref-hist.xml");
    assert.equal(full.written, 4);

    written.length = 0;
    const yesterday = new Date(Date.now() - 86_400_000);
    const recent = await syncExchangeRates(
      fakeClient([
        { currency: "USD", _max: { day: yesterday } },
        { currency: "GBP", _max: { day: yesterday } },
      ]),
      { fetch: fetchStub },
    );
    assert.equal(recent.file, "eurofxref-hist-90d.xml");
    assert.deepEqual(
      written.map((row) => `${row.currency}:${row.day.toISOString().slice(0, 10)}:${row.rate}`).sort(),
      [`GBP:${today}:0.8`, `USD:${today}:1.2`],
    );
    assert.ok(urls[0].endsWith("/eurofxref-hist.xml") && urls[1].endsWith("/eurofxref-hist-90d.xml"));
  });
});

describe("achats en devise", () => {
  it("buildInvestmentLines : achat en USD converti au taux du jour d'achat, sinon du jour d'ajout", () => {
    const rates = { "USD:2026-01-05": 1.25, "GBP:2026-01-10": 0.8 };
    const lines = buildInvestmentLines(
      [
        item({ id: "usd", printingId: "p1", quantity: 2, purchasePrice: "5", purchaseCurrency: "USD", purchasedAt: "2026-01-05" }),
        item({ id: "gbp", printingId: "p1", purchasePrice: "4", purchaseCurrency: "GBP" }),
        item({ id: "nofx", printingId: "p1", purchasePrice: "4", purchaseCurrency: "USD", purchasedAt: "2025-06-01" }),
      ],
      printings,
      cards,
      rates,
    );
    const byId = new Map(lines.map((line) => [line.itemId, line]));
    assert.equal(byId.get("usd")?.costEur, 8);
    assert.equal(byId.get("usd")?.profit, 32, "2 × 20 € − 8 €");
    assert.equal(byId.get("usd")?.profitBasis, 8);
    assert.equal(byId.get("gbp")?.costEur, 5, "sans date d'achat : taux du jour d'ajout");
    assert.equal(byId.get("nofx")?.costEur, null);
    assert.equal(byId.get("nofx")?.profit, null);

    const summary = summarizeInvestment(lines);
    assert.equal(summary.investedEur, 13);
    assert.equal(summary.unconvertedLines, 1);
    const [grouped] = groupInvestmentPositions(lines);
    assert.equal(grouped.purchaseTotal, null, "devises mélangées : pas de total dans une devise");
    assert.equal(grouped.costEur, 13);
  });

  it("investmentRateKeys : achats en devise des lignes et des ventes, ventes en devise", () => {
    const keys = investmentRateKeys(
      [
        item({ id: "a", printingId: "p1", purchasePrice: "5", purchaseCurrency: "USD", purchasedAt: "2026-01-05" }),
        item({ id: "b", printingId: "p1", purchasePrice: "5", purchaseCurrency: "EUR" }),
        item({ id: "c", printingId: "p1", purchasePrice: "5", purchaseCurrency: "GBP", quantity: 0 }),
        item({ id: "d", printingId: "p1", purchasePrice: null, purchaseCurrency: "USD" }),
      ],
      [sale({ id: "s", printingId: "p1", purchasePrice: "3.00", purchaseCurrency: "GBP", saleCurrency: "USD", soldAt: "2026-02-01" })],
    );
    assert.deepEqual(keys, ["GBP:2026-01-10", "USD:2026-01-05", "USD:2026-02-01"]);
  });
});

describe("ventes et plus-value réalisée", () => {
  it("buildSaleLines : net des frais moins prix de revient, en euros ; tri du plus récent", () => {
    const lines = buildSaleLines(
      [
        sale({ id: "old", printingId: "p1", quantity: 2, purchasePrice: "4.00", purchaseCurrency: "EUR", salePrice: "30.00", fees: "2.00", soldAt: "2026-02-01" }),
        sale({ id: "usd", printingId: "p2", salePrice: "12.50", saleCurrency: "USD", purchasePrice: "3.00", purchaseCurrency: "EUR", soldAt: "2026-03-01" }),
        sale({ id: "nocost", printingId: "p1", salePrice: "9.00", soldAt: "2026-02-15" }),
        sale({ id: "orphan", printingId: "absent" }),
      ],
      printings,
      cards,
      { "USD:2026-03-01": 1.25 },
    );
    assert.deepEqual(lines.map((line) => line.saleId), ["usd", "nocost", "old"]);
    const [usd, nocost, old] = lines;
    assert.equal(old.proceedsEur, 28);
    assert.equal(old.costEur, 8);
    assert.equal(old.realized, 20);
    assert.equal(usd.proceedsEur, 10, "12,50 $ au taux du jour de la vente");
    assert.equal(usd.realized, 7);
    assert.equal(nocost.costEur, null);
    assert.equal(nocost.realized, null);
    assert.equal(usd.title, "Bravo Two");

    const summary = summarizeSales(lines);
    assert.equal(summary.sales, 3);
    assert.equal(summary.copies, 4);
    assert.equal(summary.proceedsEur, 47);
    assert.equal(summary.realized, 27);
    assert.equal(summary.realizedBasis, 11);
    assert.equal(summary.unknownCost, 1);
    assert.equal(summarizeSales([]).realized, null);

    assert.deepEqual(filterSaleLines(lines, { set: "beta", language: "", q: "" }).map((line) => line.saleId), ["usd"]);
    assert.deepEqual(filterSaleLines(lines, { set: "all", language: "en", q: "alpha" }).map((line) => line.saleId), ["nocost", "old"]);
  });

  it("courbe : les exemplaires vendus en sortent le jour de la vente", () => {
    const snapshots = [
      { printingId: "p1", day: "2026-01-01", amount: 10 },
      { printingId: "p1", day: "2026-01-02", amount: 10 },
      { printingId: "p1", day: "2026-01-03", amount: 10 },
    ];
    const points = buildPortfolioHistory(
      [
        { printingId: "p1", quantity: 1, cost: 4 },
        { printingId: "p1", quantity: 2, cost: 5, untilDay: "2026-01-02" },
      ],
      snapshots,
    );
    assert.deepEqual(
      points.map((point) => [point.day, point.marketTotal, point.invested]),
      [
        ["2026-01-01", 30, 14],
        ["2026-01-02", 10, 4],
        ["2026-01-03", 10, 4],
      ],
    );
  });
});

describe("alertes de revente", () => {
  it("sellTargetReached : prix au niveau de la cible ou au-dessus, au centime près", () => {
    assert.equal(sellTargetReached(20, 20), true);
    assert.equal(sellTargetReached(20, 20.004), true);
    assert.equal(sellTargetReached(20, 19.99), false);
    assert.equal(sellTargetReached(20, 25), true);
    assert.equal(sellTargetReached(null, 25), false);
    assert.equal(sellTargetReached(20, null), false);
    assert.equal(sellTargetReached(0, 5), false, "cible nulle : pas d'alerte");
  });
});

describe("hausses, baisses et concentration", () => {
  const positions = [
    position("up-big", { title: "Up big", quantity: 2, marketUnit: 15, previousMarketUnit: 10, marketTotal: 30 }),
    position("up-small", { title: "Up small", marketUnit: 11, previousMarketUnit: 10, marketTotal: 11 }),
    position("down", { title: "Down", marketUnit: 6, previousMarketUnit: 8, marketTotal: 6 }),
    position("flat", { title: "Flat", marketUnit: 50, previousMarketUnit: 50, marketTotal: 50 }),
    position("unknown", { title: "Unknown", marketUnit: 3, marketTotal: 3 }),
    position("unpriced", { title: "Unpriced" }),
  ];

  it("topMovers : variation en euros quantité comprise, stables et sans référence exclus", () => {
    const { gainers, losers } = topMovers(positions, 5);
    assert.deepEqual(gainers.map((mover) => [mover.position.printingId, mover.amount, mover.percent]), [
      ["up-big", 10, 50],
      ["up-small", 1, 10],
    ]);
    assert.deepEqual(losers.map((mover) => [mover.position.printingId, mover.amount, mover.percent]), [["down", -2, -25]]);
    assert.equal(topMovers(positions, 1).gainers.length, 1);
  });

  it("valueConcentration : part des cartes les plus chères", () => {
    const concentration = valueConcentration(positions, 2, 3);
    assert.ok(concentration);
    assert.equal(concentration.total, 100);
    assert.equal(concentration.positions, 5);
    assert.equal(concentration.topCount, 2);
    assert.equal(concentration.topShare, 0.8);
    assert.deepEqual(
      concentration.largest.map((entry) => [entry.position.printingId, entry.share]),
      [
        ["flat", 0.5],
        ["up-big", 0.3],
        ["up-small", 0.11],
      ],
    );
    assert.equal(valueConcentration([position("none")]), null);
  });
});
