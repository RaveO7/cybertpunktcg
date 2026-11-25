import {
  matchesSetFilter,
} from "@/lib/reference-data";
import type {
  CardDTO,
  CollectionItemDTO,
  PrintingDTO,
  SetDTO,
} from "@/lib/types";
import { printingTitle } from "@/lib/cards/printings";
import { normalizeText } from "@/lib/cards/search";
import { PriceMovement, amountSign, priceMovement } from "@/lib/cards/pricing";

// Mêmes ordres que localeCompare(…, "fr"[, { numeric: true }]), sans recréer un comparateur à chaque appel.
const frenchOrder = new Intl.Collator("fr");
const frenchNumericOrder = new Intl.Collator("fr", { numeric: true });

export type InvestmentPerformance = "all" | "profit" | "loss" | "flat" | "unknown" | "rising" | "falling";

export type InvestmentLine = {
  itemId: string;
  printingId: string;
  cardId: string;
  title: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  rarity: string | null;
  imagePath: string | null;
  quantity: number;
  conditionCode: string;
  marketUnit: number | null;
  previousMarketUnit: number | null;
  marketTotal: number | null;
  purchaseUnit: number | null;
  purchaseCurrency: string | null;
  purchaseTotal: number | null;
  /** Date d'achat « AAAA-MM-JJ », null = inconnue. */
  purchasedAt: string | null;
  profit: number | null;
  /** Base du P&L (P&L = marché − base) : prix d'achat total. */
  profitBasis: number | null;
  marketDelta: PriceMovement;
};

/** Achats d'une même carte (même édition) regroupés : une ligne du portefeuille. */
export type InvestmentPosition = {
  printingId: string;
  cardId: string;
  title: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  rarity: string | null;
  imagePath: string | null;
  quantity: number;
  /** États distincts des achats, dans l'ordre des achats. */
  conditionCodes: string[];
  marketUnit: number | null;
  previousMarketUnit: number | null;
  marketTotal: number | null;
  marketDelta: PriceMovement;
  /** Somme des prix d'achat ; null si aucun prix ou si les devises diffèrent. */
  purchaseTotal: number | null;
  purchaseCurrency: string | null;
  /** Prix de revient unitaire : prix moyen payé par exemplaire. */
  purchaseUnit: number | null;
  profit: number | null;
  profitBasis: number | null;
  /** Exemplaires comptés dans le P&L (ceux qui ont un prix d'achat en EUR). */
  profitQuantity: number;
  /** Achats, du plus ancien au plus récent ; ceux sans date à la fin. */
  lines: InvestmentLine[];
};

export type SetInvestment = {
  setCode: string;
  setName: string;
  sortOrder: number;
  copies: number;
  pricedCopies: number;
  marketTotal: number;
  previousMarketTotal: number | null;
  marketDelta: PriceMovement;
  marketDeltaAmount: number | null;
  investedEur: number;
  investedLines: number;
  profitEur: number | null;
  /** Base du P&L (prix d'achat des lignes qui en ont un) : sert au % affiché. */
  profitBasis: number | null;
  profitLines: number;
};

export type InvestmentSummary = {
  marketTotal: number;
  previousMarketTotal: number | null;
  marketDelta: PriceMovement;
  marketDeltaAmount: number | null;
  investedEur: number;
  profitEur: number | null;
  /** Prix d'achat des exemplaires comptés dans le P&L (base du % de rendement). */
  profitBasis: number | null;
  copies: number;
  pricedCopies: number;
  trackedProfitCopies: number;
};

function moneyOrNull(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function buildInvestmentLines(
  items: CollectionItemDTO[],
  printings: PrintingDTO[],
  cards: Map<string, CardDTO>,
): InvestmentLine[] {
  const printingById = new Map(printings.map((printing) => [printing.id, printing]));
  const lines: InvestmentLine[] = [];
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const printing = printingById.get(item.printingId);
    if (!printing) continue;
    const card = cards.get(printing.cardId);
    if (!card) continue;
    const marketUnit = moneyOrNull(printing.marketPrice);
    const previousMarketUnit = moneyOrNull(printing.previousMarketPrice);
    const purchaseUnit = moneyOrNull(item.purchasePrice);
    const purchaseCurrency = item.purchaseCurrency || (purchaseUnit == null ? null : "EUR");
    const marketTotal = marketUnit == null ? null : marketUnit * item.quantity;
    const purchaseTotal = purchaseUnit == null ? null : purchaseUnit * item.quantity;
    const profit =
      marketTotal == null || purchaseTotal == null || purchaseCurrency !== "EUR" ? null : marketTotal - purchaseTotal;
    lines.push({
      itemId: item.id,
      printingId: printing.id,
      cardId: card.id,
      title: printingTitle(card, printing),
      setCode: printing.setCode,
      setName: printing.setName,
      collectorNumber: printing.collectorNumber,
      language: printing.language,
      rarity: printing.rarity,
      imagePath: printing.imagePath,
      quantity: item.quantity,
      conditionCode: item.conditionCode,
      marketUnit,
      previousMarketUnit,
      marketTotal,
      purchaseUnit,
      purchaseCurrency,
      purchaseTotal,
      purchasedAt: item.purchasedAt ?? null,
      profit,
      profitBasis: profit == null ? null : purchaseTotal,
      marketDelta: priceMovement(marketUnit, previousMarketUnit),
    });
  }
  return lines.sort(
    (left, right) =>
      frenchOrder.compare(left.setName, right.setName) ||
      frenchNumericOrder.compare(left.collectorNumber, right.collectorNumber) ||
      frenchOrder.compare(left.title, right.title),
  );
}

/**
 * Ramène la variation du marché à une période : elle part du prix de référence au début
 * de la période (sans prix de référence : pas de variation). Le P&L ne dépend pas de la
 * période : il reste calculé depuis le prix d'achat.
 */
export function applyInvestmentPeriod(
  lines: InvestmentLine[],
  referencePrices: Readonly<Record<string, number>>,
): InvestmentLine[] {
  return lines.map((line) => {
    const reference = referencePrices[line.printingId];
    const previousMarketUnit = reference != null && Number.isFinite(reference) ? reference : null;
    return {
      ...line,
      previousMarketUnit,
      marketDelta: priceMovement(line.marketUnit, previousMarketUnit),
    };
  });
}

/**
 * Regroupe les achats par carte (même édition) : une position par carte, dans l'ordre des lignes.
 * Le P&L ne compte que les achats qui en ont un ; le prix d'achat total, que si une seule devise.
 */
export function groupInvestmentPositions(lines: InvestmentLine[]): InvestmentPosition[] {
  const byPrinting = new Map<string, InvestmentLine[]>();
  for (const line of lines) {
    const group = byPrinting.get(line.printingId);
    if (group) group.push(line);
    else byPrinting.set(line.printingId, [line]);
  }
  return [...byPrinting.values()].map((group) => {
    const sorted = [...group].sort(
      (left, right) =>
        (left.purchasedAt == null ? 1 : 0) - (right.purchasedAt == null ? 1 : 0) ||
        (left.purchasedAt ?? "").localeCompare(right.purchasedAt ?? "") ||
        left.itemId.localeCompare(right.itemId),
    );
    const first = sorted[0];
    const currencies = new Set(sorted.filter((line) => line.purchaseTotal != null).map((line) => line.purchaseCurrency));
    const purchaseCurrency = currencies.size === 1 ? [...currencies][0] : null;
    let quantity = 0;
    let purchaseTotal = 0;
    let purchasedQuantity = 0;
    let profit = 0;
    let profitBasis = 0;
    let profitQuantity = 0;
    for (const line of sorted) {
      quantity += line.quantity;
      if (purchaseCurrency != null && line.purchaseTotal != null) {
        purchaseTotal += line.purchaseTotal;
        purchasedQuantity += line.quantity;
      }
      if (line.profit != null) {
        profit += line.profit;
        profitBasis += line.profitBasis ?? 0;
        profitQuantity += line.quantity;
      }
    }
    // Même carte : même prix de marché et même prix de référence pour tous les achats.
    const marketUnit = first.marketUnit;
    return {
      printingId: first.printingId,
      cardId: first.cardId,
      title: first.title,
      setCode: first.setCode,
      setName: first.setName,
      collectorNumber: first.collectorNumber,
      language: first.language,
      rarity: first.rarity,
      imagePath: first.imagePath,
      quantity,
      conditionCodes: [...new Set(sorted.map((line) => line.conditionCode))],
      marketUnit,
      previousMarketUnit: first.previousMarketUnit,
      marketTotal: marketUnit == null ? null : marketUnit * quantity,
      marketDelta: first.marketDelta,
      purchaseTotal: purchasedQuantity > 0 ? purchaseTotal : null,
      purchaseCurrency: purchasedQuantity > 0 ? purchaseCurrency : null,
      purchaseUnit: purchasedQuantity > 0 ? purchaseTotal / purchasedQuantity : null,
      profit: profitQuantity > 0 ? profit : null,
      profitBasis: profitQuantity > 0 ? profitBasis : null,
      profitQuantity,
      lines: sorted,
    };
  });
}

export function summarizeInvestment(lines: InvestmentLine[]): InvestmentSummary {
  let marketTotal = 0;
  let previousMarketTotal = 0;
  let compared = false;
  let investedEur = 0;
  let profitEur = 0;
  let profitBasis = 0;
  let hasProfit = false;
  let copies = 0;
  let pricedCopies = 0;
  let trackedProfitCopies = 0;
  for (const line of lines) {
    copies += line.quantity;
    if (line.marketTotal != null) {
      marketTotal += line.marketTotal;
      pricedCopies += line.quantity;
      if (line.previousMarketUnit != null) {
        previousMarketTotal += line.previousMarketUnit * line.quantity;
        compared = true;
      } else {
        previousMarketTotal += line.marketTotal;
      }
    }
    if (line.purchaseTotal != null && line.purchaseCurrency === "EUR") {
      investedEur += line.purchaseTotal;
    }
    if (line.profit != null) {
      profitEur += line.profit;
      profitBasis += line.profitBasis ?? 0;
      hasProfit = true;
      trackedProfitCopies += line.quantity;
    }
  }
  const previous = compared ? previousMarketTotal : null;
  return {
    marketTotal,
    previousMarketTotal: previous,
    marketDelta: priceMovement(marketTotal, previous),
    marketDeltaAmount: previous == null ? null : marketTotal - previous,
    investedEur,
    profitEur: hasProfit ? profitEur : null,
    profitBasis: hasProfit ? profitBasis : null,
    copies,
    pricedCopies,
    trackedProfitCopies,
  };
}

export function investmentBySet(lines: InvestmentLine[], sets: SetDTO[]): SetInvestment[] {
  const byCode = new Map<
    string,
    SetInvestment & { compared: boolean; previousAcc: number }
  >();
  for (const set of sets) {
    byCode.set(set.code, {
      setCode: set.code,
      setName: set.name,
      sortOrder: set.sortOrder,
      copies: 0,
      pricedCopies: 0,
      marketTotal: 0,
      previousMarketTotal: null,
      marketDelta: "none",
      marketDeltaAmount: null,
      investedEur: 0,
      investedLines: 0,
      profitEur: null,
      profitBasis: null,
      profitLines: 0,
      compared: false,
      previousAcc: 0,
    });
  }
  for (const line of lines) {
    let entry = byCode.get(line.setCode);
    if (!entry) {
      entry = {
        setCode: line.setCode,
        setName: line.setName,
        sortOrder: 9999,
        copies: 0,
        pricedCopies: 0,
        marketTotal: 0,
        previousMarketTotal: null,
        marketDelta: "none",
        marketDeltaAmount: null,
        investedEur: 0,
        investedLines: 0,
        profitEur: null,
        profitBasis: null,
        profitLines: 0,
        compared: false,
        previousAcc: 0,
      };
      byCode.set(line.setCode, entry);
    }
    entry.copies += line.quantity;
    if (line.marketTotal != null) {
      entry.marketTotal += line.marketTotal;
      entry.pricedCopies += line.quantity;
      if (line.previousMarketUnit != null) {
        entry.previousAcc += line.previousMarketUnit * line.quantity;
        entry.compared = true;
      } else {
        // Sans historique : on ne fabrique pas de variation artificielle.
        entry.previousAcc += line.marketTotal;
      }
    }
    if (line.purchaseTotal != null && line.purchaseCurrency === "EUR") {
      entry.investedEur += line.purchaseTotal;
      entry.investedLines += 1;
    }
    if (line.profit != null) {
      entry.profitEur = (entry.profitEur ?? 0) + line.profit;
      entry.profitBasis = (entry.profitBasis ?? 0) + (line.profitBasis ?? 0);
      entry.profitLines += 1;
    }
  }
  return [...byCode.values()]
    .filter((entry) => entry.copies > 0)
    .map((entry) => {
      const previous = entry.compared ? entry.previousAcc : null;
      return {
        setCode: entry.setCode,
        setName: entry.setName,
        sortOrder: entry.sortOrder,
        copies: entry.copies,
        pricedCopies: entry.pricedCopies,
        marketTotal: entry.marketTotal,
        previousMarketTotal: previous,
        marketDelta: priceMovement(entry.marketTotal, previous),
        marketDeltaAmount: previous == null ? null : entry.marketTotal - previous,
        investedEur: entry.investedEur,
        investedLines: entry.investedLines,
        profitEur: entry.profitEur,
        profitBasis: entry.profitBasis,
        profitLines: entry.profitLines,
      };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.setName.localeCompare(right.setName, "fr"));
}

export function filterInvestmentLines(
  lines: InvestmentLine[],
  filters: {
    set: string;
    language: string;
    performance: InvestmentPerformance;
    q: string;
  },
) {
  const query = normalizeText(filters.q);
  return lines.filter((line) => {
    if (!matchesSetFilter(line.setCode, filters.set)) return false;
    if (filters.language && line.language !== filters.language) return false;
    if (filters.performance === "profit" && !(line.profit != null && amountSign(line.profit) > 0)) return false;
    if (filters.performance === "loss" && !(line.profit != null && amountSign(line.profit) < 0)) return false;
    if (filters.performance === "flat" && !(line.profit != null && amountSign(line.profit) === 0)) return false;
    if (filters.performance === "unknown" && line.profit != null) return false;
    if (filters.performance === "rising" && line.marketDelta !== "up") return false;
    if (filters.performance === "falling" && line.marketDelta !== "down") return false;
    if (query) {
      const hay = normalizeText(
        `${line.title} ${line.setName} ${line.collectorNumber} ${line.rarity ?? ""} ${line.conditionCode}`,
      );
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}
