// Tri des tableaux de la page Investissement (par extension et par ligne).

import type { Translator } from "@/i18n/translator";
import type { InvestmentLine, SetInvestment } from "@/lib/logic";

export type SortDir = "asc" | "desc";

export type SetSortKey = "set" | "copies" | "marketValue" | "marketVar" | "invested" | "purchasePnL";
export type LineSortKey = "card" | "set" | "qty" | "purchase" | "market" | "marketVar" | "purchasePnL";

export type SortState<K extends string> = { key: K; dir: SortDir };

/** Colonnes monétaires / numériques : premier clic = décroissant (plus cher / plus fort d’abord). */
const DESC_FIRST_COLUMNS = new Set<string>([
  "copies",
  "qty",
  "marketValue",
  "marketVar",
  "invested",
  "purchasePnL",
  "purchase",
  "market",
]);

export function initialSortDir(columnKey: string): SortDir {
  return DESC_FIRST_COLUMNS.has(columnKey) ? "desc" : "asc";
}

export const SET_SORT_KEYS: SetSortKey[] = ["marketValue", "marketVar", "purchasePnL", "invested", "copies", "set"];
export const LINE_SORT_KEYS: LineSortKey[] = ["market", "marketVar", "purchasePnL", "purchase", "qty", "card", "set"];

export function setSortLabel(key: SetSortKey, t: Translator) {
  const labels: Record<SetSortKey, string> = {
    set: t("investment.set"),
    copies: t("investment.copies"),
    marketValue: t("investment.marketValue"),
    marketVar: t("investment.marketVar"),
    invested: t("investment.investedCol"),
    purchasePnL: t("investment.purchasePnL"),
  };
  return labels[key];
}

export function lineSortLabel(key: LineSortKey, t: Translator) {
  const labels: Record<LineSortKey, string> = {
    card: t("investment.card"),
    set: t("investment.set"),
    qty: t("investment.qty"),
    purchase: t("investment.purchase"),
    market: t("investment.market"),
    marketVar: t("investment.marketVar"),
    purchasePnL: t("investment.purchasePnL"),
  };
  return labels[key];
}

export function sortSetRows(rows: SetInvestment[], sort: SortState<SetSortKey>) {
  const list = [...rows];
  list.sort((left, right) => {
    let result = 0;
    switch (sort.key) {
      case "set":
        result = directedText(left.setName, right.setName, sort.dir);
        break;
      case "copies":
        result = directedNumber(left.copies, right.copies, sort.dir);
        break;
      case "marketValue":
        result = directedNumber(left.marketTotal, right.marketTotal, sort.dir);
        break;
      case "marketVar":
        result = directedNullableNumber(movingAmount(left.marketDeltaAmount), movingAmount(right.marketDeltaAmount), sort.dir);
        break;
      case "invested":
        result = directedNumber(left.investedEur, right.investedEur, sort.dir);
        break;
      case "purchasePnL":
        result = directedNullableNumber(left.profitEur, right.profitEur, sort.dir);
        break;
    }
    if (result === 0) result = left.sortOrder - right.sortOrder || compareText(left.setName, right.setName);
    return result;
  });
  return list;
}

export function sortLineRows(rows: InvestmentLine[], sort: SortState<LineSortKey>) {
  const list = [...rows];
  list.sort((left, right) => {
    let result = 0;
    switch (sort.key) {
      case "card":
        result =
          directedText(left.title, right.title, sort.dir) ||
          directedText(left.collectorNumber, right.collectorNumber, sort.dir);
        break;
      case "set":
        result =
          directedText(left.setName, right.setName, sort.dir) ||
          directedText(left.collectorNumber, right.collectorNumber, sort.dir);
        break;
      case "qty":
        result = directedNumber(left.quantity, right.quantity, sort.dir);
        break;
      case "purchase":
        result = directedNullableNumber(left.purchaseTotal, right.purchaseTotal, sort.dir);
        break;
      case "market":
        // Toujours le prix Cardmarket actuel (marketUnit), pas previousMarketUnit.
        result =
          directedNullableNumber(left.marketUnit, right.marketUnit, sort.dir) ||
          directedNullableNumber(left.marketTotal, right.marketTotal, sort.dir);
        break;
      case "marketVar":
        result = directedNullableNumber(movingAmount(lineMarketDelta(left)), movingAmount(lineMarketDelta(right)), sort.dir);
        break;
      case "purchasePnL":
        result = directedNullableNumber(left.profit, right.profit, sort.dir);
        break;
    }
    if (result === 0) {
      result =
        compareText(left.setName, right.setName) ||
        compareText(left.collectorNumber, right.collectorNumber) ||
        compareText(left.itemId, right.itemId);
    }
    return result;
  });
  return list;
}

export function lineMarketDelta(line: InvestmentLine) {
  if (line.marketUnit == null || line.previousMarketUnit == null) return null;
  return (line.marketUnit - line.previousMarketUnit) * line.quantity;
}

/** Variation nulle (« — ») : rangée avec les lignes sans variation, toujours en fin de liste. */
function movingAmount(value: number | null) {
  return value == null || Math.abs(value) < 0.005 ? null : value;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

function directedText(left: string, right: string, dir: SortDir) {
  const result = compareText(left, right);
  return dir === "asc" ? result : -result;
}

function directedNumber(left: number, right: number, dir: SortDir) {
  const result = left - right;
  return dir === "asc" ? result : -result;
}

/** Valeurs nulles toujours en fin de liste, quel que soit le sens. */
function directedNullableNumber(left: number | null | undefined, right: number | null | undefined, dir: SortDir) {
  const leftNull = left == null || !Number.isFinite(left);
  const rightNull = right == null || !Number.isFinite(right);
  if (leftNull && rightNull) return 0;
  if (leftNull) return 1;
  if (rightNull) return -1;
  return directedNumber(left, right, dir);
}
