import { baseCollectorNumber } from "../cards/printings";
import { productNameKey } from "./keys";
import type { LocalPrinting, PriceAssignment } from "./types";

export type AssignmentCoverage = {
  assignments: number;
  uniqueProducts: number;
  uniquePrintings: number;
  reusedProductIds: number[];
  /** Extra rows created by cloning the same Cardmarket product onto several printings. */
  cloneExtra: number;
};

/** Summarize match output for clone / coverage assertions. */
export function assignmentCoverage(assignments: PriceAssignment[]): AssignmentCoverage {
  const productIds = assignments.map((row) => row.productId);
  const printingIds = assignments.map((row) => row.printingId);
  const uniqueProducts = new Set(productIds);
  const uniquePrintings = new Set(printingIds);
  const reusedProductIds = [...uniqueProducts].filter(
    (productId) => productIds.filter((id) => id === productId).length > 1,
  );
  return {
    assignments: assignments.length,
    uniqueProducts: uniqueProducts.size,
    uniquePrintings: uniquePrintings.size,
    reusedProductIds,
    cloneExtra: assignments.length - uniqueProducts.size,
  };
}

/**
 * No beta→retail price copy: those are distinct market SKUs even when Cardmarket
 * only lists one expansion. Unreleased twins simply stay unpriced.
 * @deprecated Kept empty so policy tests can assert nothing is allow-listed.
 */
export const RETAIL_PRICE_PROPAGATION: Readonly<Record<string, string>> = {};

/** Pairs that must never share a Cardmarket `idProduct`. */
export const DISTINCT_MARKET_SET_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["welcometonightcitybeta", "welcometonightcityretail"],
  ["theheistbetastarterdeck", "theheistretailstarterdeck"],
  ["embracingpowerbetastarterdeck", "embracingpowerretailstarterdeck"],
  ["boxtoppersbeta", "boxtoppersretail"],
  ["prereleasebeta", "prereleaseretail"],
];

export type SharedProductClone = {
  leftPrintingId: string;
  rightPrintingId: string;
  leftSetCode: string;
  rightSetCode: string;
  productId: number;
  amount: string;
  name: string;
};

/** Language twins (`set` / `set-fr`) must never share a Cardmarket productId either. */
export function languageMarketSetPairs(setCodes: Iterable<string>): Array<readonly [string, string]> {
  const codes = new Set(setCodes);
  const pairs: Array<readonly [string, string]> = [];
  for (const code of codes) {
    if (code.endsWith("-fr")) continue;
    const fr = `${code}-fr`;
    if (codes.has(fr)) pairs.push([code, fr]);
  }
  return pairs;
}

/** Detects assignments that reuse the same Cardmarket productId across distinct SKUs. */
export function findSharedProductClones(
  assignments: PriceAssignment[],
  printings: LocalPrinting[],
  pairs: ReadonlyArray<readonly [string, string]> = [
    ...DISTINCT_MARKET_SET_PAIRS,
    ...languageMarketSetPairs(printings.map((printing) => printing.setCode)),
  ],
) {
  const byKey = new Map<string, LocalPrinting>();
  for (const printing of printings) {
    byKey.set(
      `${printing.setCode}|${productNameKey(printing.name)}|${baseCollectorNumber(printing.collectorNumber)}`,
      printing,
    );
  }
  const assignmentByPrinting = new Map(assignments.map((row) => [row.printingId, row]));
  const clones: SharedProductClone[] = [];
  for (const [leftCode, rightCode] of pairs) {
    for (const printing of printings) {
      if (printing.setCode !== leftCode) continue;
      const left = assignmentByPrinting.get(printing.id);
      if (!left) continue;
      const rightPrinting = byKey.get(
        `${rightCode}|${productNameKey(printing.name)}|${baseCollectorNumber(printing.collectorNumber)}`,
      );
      if (!rightPrinting) continue;
      const right = assignmentByPrinting.get(rightPrinting.id);
      if (!right || right.productId !== left.productId) continue;
      clones.push({
        leftPrintingId: printing.id,
        rightPrintingId: rightPrinting.id,
        leftSetCode: leftCode,
        rightSetCode: rightCode,
        productId: left.productId,
        amount: left.amount,
        name: printing.name,
      });
    }
  }
  return clones;
}
