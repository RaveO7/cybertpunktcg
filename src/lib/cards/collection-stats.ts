import {
  RARITY_ORDER,
} from "@/lib/reference-data";
import type {
  CollectionItemDTO,
  Ownership,
  PrintingDTO,
  Progress,
  SetDTO,
} from "@/lib/types";
import { rank } from "@/lib/cards/sort";
import { priceMovement } from "@/lib/cards/pricing";

export function aggregateCollection(items: CollectionItemDTO[]) {
  const map = new Map<string, Ownership>();
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const current = map.get(item.printingId) ?? {
      qty: 0,
      conditions: [],
    };
    current.qty += item.quantity;
    if (!current.conditions.includes(item.conditionCode)) {
      current.conditions.push(item.conditionCode);
    }
    map.set(item.printingId, current);
  }
  return map;
}

export function ownershipOf(
  printingId: string,
  agg: Map<string, Ownership>,
): Ownership {
  return agg.get(printingId) ?? { qty: 0, conditions: [] };
}

export function computeProgress(printings: PrintingDTO[], agg: Map<string, Ownership>): Progress {
  let uniqueOwned = 0;
  let duplicates = 0;
  let extraCopies = 0;
  let totalCopies = 0;
  for (const printing of printings) {
    const owned = ownershipOf(printing.id, agg);
    totalCopies += owned.qty;
    if (owned.qty > 0) uniqueOwned += 1;
    if (owned.qty > 1) {
      duplicates += 1;
      extraCopies += owned.qty - 1;
    }
  }
  const total = printings.length;
  return {
    uniqueOwned,
    total,
    missing: total - uniqueOwned,
    duplicates,
    extraCopies,
    totalCopies,
    percent: total === 0 ? 0 : (uniqueOwned / total) * 100,
  };
}

export function progressByRarity(printings: PrintingDTO[], agg: Map<string, Ownership>) {
  const groups = new Map<string, PrintingDTO[]>();
  for (const printing of printings) {
    const key = printing.rarity ?? "Inconnue";
    const list = groups.get(key) ?? [];
    list.push(printing);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([rarity, group]) => ({ rarity, ...computeProgress(group, agg) }))
    .sort((a, b) => rank(RARITY_ORDER, a.rarity) - rank(RARITY_ORDER, b.rarity));
}

export function progressBySet(
  printings: PrintingDTO[],
  sets: SetDTO[],
  agg: Map<string, Ownership>,
) {
  return [...sets]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
    .map((set) => {
      const group = printings.filter((printing) => printing.setCode === set.code);
      return { set, ...computeProgress(group, agg) };
    });
}


export function marketValue(printings: PrintingDTO[], agg: Map<string, Ownership>) {
  let total = 0;
  let previousTotal = 0;
  let pricedCopies = 0;
  let unpricedCopies = 0;
  let comparedCopies = 0;
  for (const printing of printings) {
    const quantity = agg.get(printing.id)?.qty ?? 0;
    if (quantity <= 0) continue;
    const amount = printing.marketPrice == null ? Number.NaN : Number(printing.marketPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      unpricedCopies += quantity;
      continue;
    }
    total += amount * quantity;
    pricedCopies += quantity;
    const previous = printing.previousMarketPrice == null ? Number.NaN : Number(printing.previousMarketPrice);
    if (Number.isFinite(previous) && previous > 0) {
      previousTotal += previous * quantity;
      comparedCopies += quantity;
    } else {
      previousTotal += amount * quantity;
    }
  }
  return {
    total,
    previousTotal: comparedCopies > 0 ? previousTotal : null,
    pricedCopies,
    unpricedCopies,
    delta: priceMovement(total, comparedCopies > 0 ? previousTotal : null),
  };
}

export function spentAmount(items: CollectionItemDTO[]) {
  const totals = new Map<string, number>();
  let pricedLines = 0;
  for (const item of items) {
    if (!item.purchasePrice) continue;
    const amount = Number(item.purchasePrice);
    if (!Number.isFinite(amount)) continue;
    pricedLines += 1;
    const currency = item.purchaseCurrency || "EUR";
    totals.set(currency, (totals.get(currency) ?? 0) + amount * item.quantity);
  }
  return { totals: [...totals.entries()], pricedLines };
}
