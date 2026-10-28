// Tri des tableaux de la page Investissement (par extension et par ligne).

import type { Translator } from "@/i18n/translator";
import { amountSign, type InvestmentLine, type InvestmentPosition, type SetInvestment } from "@/lib/logic";

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

// Ordre du menu de tri (téléphone) : les colonnes chiffrées d'abord.
export const SET_SORT_KEYS: SetSortKey[] = ["marketValue", "marketVar", "purchasePnL", "invested", "copies", "set"];
export const LINE_SORT_KEYS: LineSortKey[] = ["market", "marketVar", "purchasePnL", "purchase", "qty", "card", "set"];

// Colonnes des tableaux (ordinateur), de gauche à droite.
export const SET_TABLE_KEYS: SetSortKey[] = ["set", "copies", "marketValue", "marketVar", "invested", "purchasePnL"];
export const LINE_TABLE_KEYS: LineSortKey[] = ["card", "set", "qty", "purchase", "market", "marketVar", "purchasePnL"];

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

/** Tri par extension ; les noms suivent l'ordre alphabétique de la langue de la page (`locale`). */
export function sortSetRows(rows: SetInvestment[], sort: SortState<SetSortKey>, locale: string) {
  const collator = textCollator(locale);
  const list = [...rows];
  list.sort((left, right) => {
    let result = 0;
    switch (sort.key) {
      case "set":
        result = directedText(collator, left.setName, right.setName, sort.dir);
        break;
      case "copies":
        result = directedNumber(left.copies, right.copies, sort.dir);
        break;
      case "marketValue":
        result = directedNumber(left.marketTotal, right.marketTotal, sort.dir);
        break;
      // Comme le détail : tri sur le % affiché en principal, puis sur le montant.
      case "marketVar":
        result =
          directedNullableNumber(setMovingPct(left), setMovingPct(right), sort.dir) ||
          directedNullableNumber(movingAmount(left.marketDeltaAmount), movingAmount(right.marketDeltaAmount), sort.dir);
        break;
      case "invested":
        result = directedNumber(left.investedEur, right.investedEur, sort.dir);
        break;
      case "purchasePnL":
        result =
          directedNullableNumber(setProfitPct(left), setProfitPct(right), sort.dir) ||
          directedNullableNumber(left.profitEur, right.profitEur, sort.dir);
        break;
    }
    if (result === 0) result = left.sortOrder - right.sortOrder || collator.compare(left.setName, right.setName);
    return result;
  });
  return list;
}

/**
 * Tri du détail : porte sur les cartes regroupées (positions), pas sur chaque achat. Les textes suivent
 * l'ordre alphabétique de la langue de la page (`locale`).
 */
export function sortPositionRows(rows: InvestmentPosition[], sort: SortState<LineSortKey>, locale: string) {
  const collator = textCollator(locale);
  const list = [...rows];
  list.sort((left, right) => {
    let result = 0;
    switch (sort.key) {
      case "card":
        result =
          directedText(collator, left.title, right.title, sort.dir) ||
          directedText(collator, left.collectorNumber, right.collectorNumber, sort.dir);
        break;
      case "set":
        result =
          directedText(collator, left.setName, right.setName, sort.dir) ||
          directedText(collator, left.collectorNumber, right.collectorNumber, sort.dir);
        break;
      case "qty":
        result = directedNumber(left.quantity, right.quantity, sort.dir);
        break;
      case "purchase":
        result = directedNullableNumber(left.purchaseTotal, right.purchaseTotal, sort.dir);
        break;
      case "market":
        // Valeur actuelle affichée en principal (total), puis le prix unitaire ; jamais previousMarketUnit.
        result =
          directedNullableNumber(left.marketTotal, right.marketTotal, sort.dir) ||
          directedNullableNumber(left.marketUnit, right.marketUnit, sort.dir);
        break;
      // Variation et P&L : tri sur le % affiché en principal, puis sur le montant.
      case "marketVar":
        result =
          directedNullableNumber(movingPct(left), movingPct(right), sort.dir) ||
          directedNullableNumber(movingAmount(lineMarketDelta(left)), movingAmount(lineMarketDelta(right)), sort.dir);
        break;
      case "purchasePnL":
        result =
          directedNullableNumber(lineProfitPct(left), lineProfitPct(right), sort.dir) ||
          directedNullableNumber(left.profit, right.profit, sort.dir);
        break;
    }
    if (result === 0) {
      result =
        collator.compare(left.setName, right.setName) ||
        collator.compare(left.collectorNumber, right.collectorNumber) ||
        collator.compare(left.printingId, right.printingId);
    }
    return result;
  });
  return list;
}

type MarketFigures = Pick<InvestmentLine, "marketUnit" | "previousMarketUnit" | "quantity">;

/** Variation de valeur de toute la ligne (quantité comprise), comme les colonnes Achat, Marché et P&L. */
export function lineMarketDelta(line: MarketFigures) {
  if (line.marketUnit == null || line.previousMarketUnit == null) return null;
  return (line.marketUnit - line.previousMarketUnit) * line.quantity;
}

/** Variation du marché en % : identique pour un exemplaire ou pour toute la ligne. */
export function lineMarketDeltaPct(line: MarketFigures) {
  if (line.marketUnit == null || line.previousMarketUnit == null || line.previousMarketUnit <= 0) return null;
  return ((line.marketUnit - line.previousMarketUnit) / line.previousMarketUnit) * 100;
}

/** P&L en % de sa base : le coût d'achat des exemplaires comptés. */
export function lineProfitPct(line: Pick<InvestmentLine, "profit" | "profitBasis">) {
  if (line.profit == null || line.profitBasis == null || line.profitBasis <= 0) return null;
  return (line.profit / line.profitBasis) * 100;
}

/** Variation du marché d'une extension en % de sa valeur au début de la période. */
export function setMarketDeltaPct(row: Pick<SetInvestment, "marketDeltaAmount" | "previousMarketTotal">) {
  if (row.marketDeltaAmount == null || row.previousMarketTotal == null || row.previousMarketTotal <= 0) return null;
  return (row.marketDeltaAmount / row.previousMarketTotal) * 100;
}

/** P&L d'une extension en % de son prix d'achat. */
export function setProfitPct(row: Pick<SetInvestment, "profitEur" | "profitBasis">) {
  return lineProfitPct({ profit: row.profitEur, profitBasis: row.profitBasis });
}

/** Variation nulle (« — ») : rangée avec les lignes sans variation, toujours en fin de liste. */
function movingAmount(value: number | null) {
  return value == null || amountSign(value) === 0 ? null : value;
}

function movingPct(line: MarketFigures) {
  return movingAmount(lineMarketDelta(line)) == null ? null : lineMarketDeltaPct(line);
}

function setMovingPct(row: SetInvestment) {
  return movingAmount(row.marketDeltaAmount) == null ? null : setMarketDeltaPct(row);
}

// Un comparateur par langue, partagé par tous les tris : en créer un coûte cher.
const collators = new Map<string, Intl.Collator>();

function textCollator(locale: string) {
  let collator = collators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    collators.set(locale, collator);
  }
  return collator;
}

function directedText(collator: Intl.Collator, left: string, right: string, dir: SortDir) {
  const result = collator.compare(left, right);
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
