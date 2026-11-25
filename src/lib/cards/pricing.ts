import type {
  PrintingDTO,
} from "@/lib/types";
import { marketAmount } from "@/lib/cards/sort";

/** Somme des prix Cardmarket d'une liste d'impressions (un exemplaire chacune). */
export function printingsPriceTotal(printings: PrintingDTO[]) {
  let total = 0;
  let unpriced = 0;
  for (const printing of printings) {
    const amount = marketAmount(printing);
    if (amount == null || amount <= 0) unpriced += 1;
    else total += amount;
  }
  return { total, unpriced };
}

/** Prix d'une sélection { printingId: copies } ; `unpriced` compte les exemplaires sans prix. */
export function selectionPriceTotal(printings: PrintingDTO[], selection: Record<string, number>) {
  let total = 0;
  let unpriced = 0;
  for (const printing of printings) {
    const quantity = selection[printing.id] ?? 0;
    if (quantity <= 0) continue;
    const amount = marketAmount(printing);
    if (amount == null || amount <= 0) unpriced += quantity;
    else total += amount * quantity;
  }
  return { total, unpriced };
}


/** Moins d'un demi-centime : le montant s'affiche « 0,00 » et compte pour nul (ni gain, ni perte, ni variation). */
export const MONEY_EPSILON = 0.005;

/** Signe d'un montant en euros : 0 quand il s'arrondit à zéro centime. */
export function amountSign(value: number): -1 | 0 | 1 {
  if (Math.abs(value) < MONEY_EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

export type PriceMovement = "up" | "down" | "flat" | "none";

export function priceMovement(current: number | null, previous: number | null): PriceMovement {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return "none";
  const sign = amountSign(current - previous);
  if (sign === 0) return "flat";
  return sign > 0 ? "up" : "down";
}

/** Vrai quand le prix du marché est au niveau du prix cible de la liste de souhaits ou en dessous. */
export function wishlistTargetReached(target: number | null, price: number | null) {
  if (target == null || price == null || !Number.isFinite(target) || !Number.isFinite(price) || price <= 0) return false;
  return Math.round(price * 100) <= Math.round(target * 100);
}
