import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import type { ChartPoint, ChartPurchase } from "../../src/components/PriceChart";
import { attachPurchases, chartRangeStart, filterChartRange } from "../../src/components/investment/chart-range";
import { initialSortDir, sortPositionRows, sortSetRows } from "../../src/components/investment/sorting";
import {
  NO_SELECTION,
  clickRow,
  displayRows,
  isCollapsed,
  rowRangeIds,
  touchRow,
  type LineSelection,
} from "../../src/components/investment/use-line-selection";
import {
  amountSign,
  filterInvestmentLines,
  priceMovement,
  type InvestmentLine,
  type InvestmentPosition,
  type SetInvestment,
} from "../../src/lib/logic";

function line(partial: Partial<InvestmentLine> & { itemId: string }): InvestmentLine {
  return {
    printingId: "p",
    cardId: "c",
    title: "Carte",
    setCode: "alpha",
    setName: "Alpha",
    collectorNumber: "1",
    language: "en",
    rarity: null,
    imagePath: null,
    quantity: 1,
    conditionCode: "NM",
    marketUnit: null,
    previousMarketUnit: null,
    marketTotal: null,
    purchaseUnit: null,
    purchaseCurrency: null,
    purchaseTotal: null,
    costEur: null,
    purchasedAt: null,
    profit: null,
    profitBasis: null,
    marketDelta: "none",
    ...partial,
  };
}

/** Carte du détail ; un achat par id de `itemIds`. */
function position(
  printingId: string,
  partial: Partial<InvestmentPosition> = {},
  itemIds: string[] = [`${printingId}-1`],
): InvestmentPosition {
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
    lines: itemIds.map((itemId) => line({ itemId, printingId })),
    ...partial,
  };
}

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

const ids = (rows: { printingId: string }[]) => rows.map((row) => row.printingId);

describe("durée de la courbe", () => {
  const points: ChartPoint[] = ["2026-02-20", "2026-03-01", "2026-03-15", "2026-03-31"].map((day) => ({ day, value: 1 }));

  it("premier jour compté depuis le dernier point ; « Total » = pas de borne", () => {
    assert.equal(chartRangeStart(points, "1d"), "2026-03-30");
    assert.equal(chartRangeStart(points, "1w"), "2026-03-24");
    assert.equal(chartRangeStart(points, "1m"), "2026-03-01");
    assert.equal(chartRangeStart(points, "1y"), "2025-03-31");
    assert.equal(chartRangeStart(points, "all"), null);
  });

  it("sans point : compté depuis aujourd'hui", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-10T12:00:00.000Z"));
      assert.equal(chartRangeStart([], "1w"), "2026-05-03");
    } finally {
      vi.useRealTimers();
    }
  });

  it("garde les points à partir du premier jour inclus", () => {
    assert.deepEqual(
      filterChartRange(points, "1m").map((point) => point.day),
      ["2026-03-01", "2026-03-15", "2026-03-31"],
    );
    assert.equal(filterChartRange(points, "all"), points, "« Total » : la liste telle quelle");
  });
});

describe("achats sur la courbe", () => {
  const points: ChartPoint[] = ["2026-03-01", "2026-03-05", "2026-03-10"].map((day) => ({ day, value: 1 }));
  const purchase = (day: string, title: string): ChartPurchase => ({ day, title, quantity: 1, unitPrice: 2, currency: "EUR" });
  const before = purchase("2026-02-10", "avant l'historique");
  const between = purchase("2026-03-03", "entre deux points");
  const onPoint = purchase("2026-03-05", "le jour d'un point");
  const after = purchase("2026-03-20", "après le dernier point");
  const titles = (result: ChartPoint[]) => result.map((point) => point.purchases?.map((entry) => entry.title) ?? []);

  it("chaque achat va sur le premier point à sa date ou après, sinon sur le dernier", () => {
    const result = attachPurchases(points, [before, between, onPoint, after], null);
    assert.deepEqual(titles(result), [["avant l'historique"], ["entre deux points", "le jour d'un point"], ["après le dernier point"]]);
    assert.equal(points[1].purchases, undefined, "points d'origine intacts");
  });

  it("durée choisie : les achats d'avant son premier jour sont ignorés", () => {
    const result = attachPurchases(points, [before, between, onPoint, after], "2026-03-04");
    assert.deepEqual(titles(result), [[], ["le jour d'un point"], ["après le dernier point"]]);
  });

  it("sans achat à placer : la courbe telle quelle", () => {
    assert.equal(attachPurchases(points, [], null), points);
    assert.equal(attachPurchases(points, [before], "2026-03-01"), points);
    assert.deepEqual(attachPurchases([], [between], null), []);
  });
});

describe("sélection des lignes du détail", () => {
  // P1 et P3 ont deux achats, P2 un seul ; P1 et P2 sont dépliées (P2 n'a rien à déplier).
  const positions = [position("P1", {}, ["a1", "a2"]), position("P2", {}, ["b1"]), position("P3", {}, ["c1", "c2"])];
  const rows = displayRows(positions, new Set(["P1", "P2"]));
  const click = (rowKey: string, itemIds: string[], keys: { ctrl?: boolean; alt?: boolean } = {}) => ({
    rowKey,
    itemIds,
    ctrl: keys.ctrl ?? false,
    alt: keys.alt ?? false,
  });
  const selected = (itemIds: string[], partial: Partial<LineSelection> = {}): LineSelection => ({
    ...NO_SELECTION,
    itemIds,
    ...partial,
  });

  it("lignes affichées : la carte, puis ses achats quand elle est dépliée", () => {
    assert.deepEqual(rows, [
      { key: "P1", itemIds: ["a1", "a2"] },
      { key: "a1", itemIds: ["a1"] },
      { key: "a2", itemIds: ["a2"] },
      { key: "P2", itemIds: ["b1"] },
      { key: "P3", itemIds: ["c1", "c2"] },
    ]);
  });

  it("plage : les achats des lignes entre les deux bornes, dans un sens ou dans l'autre", () => {
    assert.deepEqual(rowRangeIds(rows, "a2", "P3", ["c1", "c2"]), ["a2", "b1", "c1", "c2"]);
    assert.deepEqual(rowRangeIds(rows, "P3", "a2", ["a2"]), ["a2", "b1", "c1", "c2"]);
    assert.deepEqual(rowRangeIds(rows, "disparue", "P2", ["b1"]), ["b1"], "borne qui n'est plus affichée");
  });

  it("clic : cette ligne seule, re-clic : plus rien", () => {
    const first = clickRow(NO_SELECTION, click("P1", ["a1", "a2"]), rows, false);
    assert.deepEqual(first, selected(["a1", "a2"]));
    assert.deepEqual(clickRow(first, click("P2", ["b1"]), rows, true), selected(["b1"]));
    assert.deepEqual(clickRow(first, click("P1", ["a2", "a1"]), rows, true), NO_SELECTION);
  });

  it("Ctrl+clic : ajoute ou retire la ligne ; la liste reste entière tant que Ctrl est tenu", () => {
    const added = clickRow(selected(["a1", "a2"]), click("P2", ["b1"], { ctrl: true }), rows, false);
    assert.deepEqual(added, selected(["a1", "a2", "b1"], { open: true }));
    assert.deepEqual(clickRow(added, click("P1", ["a1", "a2"], { ctrl: true }), rows, false), selected(["b1"], { open: true }));
    // Liste déjà réduite à la sélection : elle le reste.
    assert.deepEqual(clickRow(selected(["a1", "a2"]), click("P1", ["a1", "a2"], { ctrl: true }), rows, true), selected([]));
  });

  it("Alt+clic puis clic : toutes les lignes entre les deux", () => {
    const anchored = clickRow(NO_SELECTION, click("a1", ["a1"], { alt: true }), rows, false);
    assert.deepEqual(anchored, selected(["a1"], { anchor: "a1", open: true }));
    // Alt relâché avant le second clic : la liste se réduit tout de suite.
    assert.deepEqual(clickRow(anchored, click("P3", ["c1", "c2"]), rows, false), selected(["a1", "a2", "b1", "c1", "c2"]));
    // Alt encore tenu : elle se réduira au relâchement.
    assert.deepEqual(
      clickRow(anchored, click("P2", ["b1"], { alt: true }), rows, false),
      selected(["a1", "a2", "b1"], { open: true }),
    );
  });

  it("toucher (téléphone) : coche ou décoche, la liste reste entière", () => {
    const checked = touchRow(selected([], { anchor: "a1" }), ["a1", "a2"], false);
    assert.deepEqual(checked, selected(["a1", "a2"], { showAll: true }));
    assert.deepEqual(touchRow(checked, ["a1", "a2"], false), selected([], { showAll: true }));
    // Liste déjà réduite par une sélection faite au clic : elle le reste.
    assert.deepEqual(touchRow(selected(["a1", "a2"]), ["b1"], true), selected(["a1", "a2", "b1"]));
  });

  it("liste réduite : une sélection terminée, faite au clic", () => {
    assert.equal(isCollapsed(selected(["a1"]), 1), true);
    assert.equal(isCollapsed(selected(["a1"], { open: true }), 1), false, "Ctrl ou Alt encore tenu");
    assert.equal(isCollapsed(selected(["a1"], { showAll: true }), 1), false, "choix au toucher");
    assert.equal(isCollapsed(selected(["a1"]), 0), false, "exemplaire écarté par les filtres");
  });
});

describe("tri du détail", () => {
  it("P&L : sur le %, puis sur le montant ; sans P&L toujours en fin de liste", () => {
    const rows = [
      position("ten", { profit: 10, profitBasis: 100 }),
      position("fifty", { profit: 5, profitBasis: 10 }),
      position("none"),
      position("tenBig", { profit: 20, profitBasis: 200 }),
    ];
    assert.deepEqual(ids(sortPositionRows(rows, { key: "purchasePnL", dir: "desc" }, "fr")), ["fifty", "tenBig", "ten", "none"]);
    assert.deepEqual(ids(sortPositionRows(rows, { key: "purchasePnL", dir: "asc" }, "fr")), ["ten", "tenBig", "fifty", "none"]);
  });

  it("variation du marché : sur le % ; variation nulle en fin de liste", () => {
    const rows = [
      position("flat", { marketUnit: 5, previousMarketUnit: 5 }),
      position("down", { marketUnit: 8, previousMarketUnit: 10 }),
      position("up", { marketUnit: 11, previousMarketUnit: 10 }),
    ];
    assert.deepEqual(ids(sortPositionRows(rows, { key: "marketVar", dir: "desc" }, "fr")), ["up", "down", "flat"]);
    assert.deepEqual(ids(sortPositionRows(rows, { key: "marketVar", dir: "asc" }, "fr")), ["down", "up", "flat"]);
  });

  it("égalité : départagée par extension, numéro, puis identifiant", () => {
    const rows = [position("a", { quantity: 1 }), position("c", { quantity: 3 }), position("b", { quantity: 3 })];
    assert.deepEqual(ids(sortPositionRows(rows, { key: "qty", dir: "desc" }, "fr")), ["b", "c", "a"]);
    assert.deepEqual(ids(sortPositionRows(rows, { key: "qty", dir: "asc" }, "fr")), ["a", "b", "c"]);
  });

  it("extension puis numéro, numéros dans l'ordre numérique", () => {
    const rows = [
      position("alpha10", { collectorNumber: "10" }),
      position("beta1", { setName: "Beta" }),
      position("alpha2", { collectorNumber: "2" }),
    ];
    assert.deepEqual(ids(sortPositionRows(rows, { key: "set", dir: "asc" }, "fr")), ["alpha2", "alpha10", "beta1"]);
    assert.deepEqual(ids(sortPositionRows(rows, { key: "set", dir: "desc" }, "fr")), ["beta1", "alpha10", "alpha2"]);
  });

  it("noms dans l'ordre alphabétique de la langue de la page", () => {
    // En espagnol, « ñ » est une lettre à part, après « n » ; ailleurs, un « n » accentué.
    const rows = [position("nandu", { title: "Ñandú" }), position("nube", { title: "Nube" })];
    assert.deepEqual(ids(sortPositionRows(rows, { key: "card", dir: "asc" }, "fr")), ["nandu", "nube"]);
    assert.deepEqual(ids(sortPositionRows(rows, { key: "card", dir: "asc" }, "es")), ["nube", "nandu"]);
    const sets = [setRow({ setCode: "nandu", setName: "Ñandú" }), setRow({ setCode: "nube", setName: "Nube" })];
    const setCodes = (locale: string) => sortSetRows(sets, { key: "set", dir: "asc" }, locale).map((row) => row.setCode);
    assert.deepEqual(setCodes("fr"), ["nandu", "nube"]);
    assert.deepEqual(setCodes("es"), ["nube", "nandu"]);
  });

  it("premier clic : décroissant sur les chiffres, croissant sur les textes", () => {
    assert.equal(initialSortDir("market"), "desc");
    assert.equal(initialSortDir("purchasePnL"), "desc");
    assert.equal(initialSortDir("card"), "asc");
    assert.equal(initialSortDir("set"), "asc");
  });
});

describe("montant nul : moins d'un demi-centime", () => {
  it("un seul seuil pour le signe d'un montant", () => {
    assert.equal(amountSign(0.004), 0);
    assert.equal(amountSign(0.0049), 0);
    assert.equal(amountSign(-0.0049), 0);
    assert.equal(amountSign(0.005), 1);
    assert.equal(amountSign(-0.005), -1);
    assert.equal(amountSign(12), 1);
  });

  it("variation du marché et filtre de performance suivent le même seuil", () => {
    assert.equal(priceMovement(10.004, 10), "flat");
    assert.equal(priceMovement(10.01, 10), "up");
    assert.equal(priceMovement(9.99, 10), "down");

    const lines = [
      line({ itemId: "tiny", profit: 0.0045 }),
      line({ itemId: "gain", profit: 0.006 }),
      line({ itemId: "loss", profit: -0.006 }),
      line({ itemId: "unknown" }),
    ];
    const kept = (performance: "profit" | "loss" | "flat" | "unknown") =>
      filterInvestmentLines(lines, { set: "all", language: "", performance, q: "" }).map((entry) => entry.itemId);
    assert.deepEqual(kept("flat"), ["tiny"], "affiché « 0,00 € » : ni gain ni perte");
    assert.deepEqual(kept("profit"), ["gain"]);
    assert.deepEqual(kept("loss"), ["loss"]);
    assert.deepEqual(kept("unknown"), ["unknown"]);
  });
});
