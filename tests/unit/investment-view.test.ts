import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { investmentViewParams, parseInvestmentView, type InvestmentView } from "../../src/components/investment/url-state";
import { setMarketDeltaPct, setProfitPct, sortSetRows } from "../../src/components/investment/sorting";
import type { SetInvestment } from "../../src/lib/logic";

const DEFAULT_VIEW: InvestmentView = {
  set: "all",
  language: "",
  performance: "all",
  query: "",
  range: "all",
  lineSort: null,
  setSort: null,
};

describe("vue de l'investissement dans l'URL", () => {
  it("URL nue : vue par défaut, et vue par défaut : URL nue", () => {
    assert.deepEqual(parseInvestmentView(new URLSearchParams("")), DEFAULT_VIEW);
    assert.equal(investmentViewParams(DEFAULT_VIEW).toString(), "");
  });

  it("aller-retour de tous les réglages", () => {
    const view: InvestmentView = {
      set: "welcometonightcityretail",
      language: "fr",
      performance: "loss",
      query: "royce & co",
      range: "1m",
      lineSort: { key: "purchasePnL", dir: "asc" },
      setSort: { key: "set", dir: "desc" },
    };
    const params = investmentViewParams(view);
    assert.equal(params.get("sort"), "purchasePnL-asc");
    assert.equal(params.get("setSort"), "set-desc");
    assert.deepEqual(parseInvestmentView(new URLSearchParams(params.toString())), view);
  });

  it("valeurs inconnues ignorées : réglage par défaut", () => {
    const view = parseInvestmentView(
      new URLSearchParams("language=de&perf=moon&range=5y&sort=price-desc&setSort=marketValue-sideways"),
    );
    assert.deepEqual(view, DEFAULT_VIEW);
    assert.equal(parseInvestmentView(new URLSearchParams("sort=-desc")).lineSort, null);
  });

  it("recherche faite d'espaces : absente de l'URL", () => {
    assert.equal(investmentViewParams({ ...DEFAULT_VIEW, query: "   " }).toString(), "");
  });

  it("paramètres étrangers à la vue (carte passée par une fiche) : non réécrits", () => {
    const view = parseInvestmentView(new URLSearchParams("printing=p1&set=alpha"));
    assert.equal(investmentViewParams(view).toString(), "set=alpha");
  });
});

function setRow(partial: Partial<SetInvestment>): SetInvestment {
  return {
    setCode: "s",
    setName: "S",
    sortOrder: 0,
    copies: 1,
    pricedCopies: 1,
    marketTotal: 0,
    previousMarketTotal: null,
    marketDelta: "none",
    marketDeltaAmount: null,
    investedEur: 0,
    investedLines: 0,
    profitEur: null,
    profitBasis: null,
    profitLines: 0,
    ...partial,
  };
}

describe("% par extension (affichés comme dans le détail)", () => {
  it("variation du marché et P&L en % de leur base", () => {
    assert.equal(setMarketDeltaPct(setRow({ marketDeltaAmount: 5, previousMarketTotal: 20 })), 25);
    assert.equal(setMarketDeltaPct(setRow({ marketDeltaAmount: 5, previousMarketTotal: 0 })), null);
    assert.equal(setProfitPct(setRow({ profitEur: -3, profitBasis: 12 })), -25);
    assert.equal(setProfitPct(setRow({ profitEur: 3, profitBasis: null })), null);
  });

  it("tri de la variation sur le %, puis sur le montant ; sans variation en fin de liste", () => {
    const rows = [
      setRow({ setCode: "big", setName: "Big", marketDeltaAmount: 50, previousMarketTotal: 1000, marketDelta: "up" }),
      setRow({ setCode: "small", setName: "Small", marketDeltaAmount: 5, previousMarketTotal: 10, marketDelta: "up" }),
      setRow({ setCode: "flat", setName: "Flat", marketDeltaAmount: 0, previousMarketTotal: 10, marketDelta: "flat" }),
    ];
    assert.deepEqual(
      sortSetRows(rows, { key: "marketVar", dir: "desc" }, "fr").map((row) => row.setCode),
      ["small", "big", "flat"],
    );
    assert.deepEqual(
      sortSetRows(rows, { key: "marketVar", dir: "asc" }, "fr").map((row) => row.setCode),
      ["big", "small", "flat"],
    );
  });
});
