import { numberMatches, normalizeText } from "../cards/search";
import { EXPANSION_ALIASES, EXPANSION_SET_BY_ID, expansionKey, productNameKey } from "./keys";
import type { CardmarketProduct, LocalPrinting, LocalSet, MatchReport, PriceAssignment } from "./types";

export function matchCardmarketPrices(
  products: CardmarketProduct[],
  trends: Map<number, number>,
  sets: LocalSet[],
  printings: LocalPrinting[],
): MatchReport {
  const prepared = printings.map((printing) => ({
    ...printing,
    nameKey: productNameKey(printing.name),
  }));
  const namesBySet = new Map<string, { names: Set<string>; printings: number }>();
  for (const printing of prepared) {
    const current = namesBySet.get(printing.setCode) ?? { names: new Set<string>(), printings: 0 };
    current.names.add(printing.nameKey);
    current.printings += 1;
    namesBySet.set(printing.setCode, current);
  }
  const setByName = new Map<string, string>();
  for (const set of sets) {
    if (set.code.endsWith("-fr")) continue;
    setByName.set(normalizeText(set.name), set.code);
  }

  const groups = new Map<string, CardmarketProduct[]>();
  for (const product of products) {
    const key = expansionKey(product);
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }

  const classified = new Map<string, { label: string | null; tied: string[] }>();
  const twinGroupKeys = new Map<string, string[]>();
  for (const [key, group] of groups) {
    const forced = EXPANSION_SET_BY_ID[key];
    const result =
      forced && namesBySet.has(forced) ? { label: forced, tied: [] as string[] } : classifyGroup(group, setByName, namesBySet);
    classified.set(key, result);
    if (!result.label && result.tied.length === 2) {
      const beta = result.tied.find((code) => /beta/i.test(code));
      const retail = result.tied.find((code) => /retail/i.test(code));
      if (beta && retail) {
        const signature = result.tied.toSorted().join("|");
        const list = twinGroupKeys.get(signature) ?? [];
        list.push(key);
        twinGroupKeys.set(signature, list);
      }
    }
  }
  for (const keys of twinGroupKeys.values()) keys.sort((left, right) => left.localeCompare(right));

  const setByGroup = new Map<string, string | null>();
  const expansions: MatchReport["expansions"] = [];
  for (const [key, group] of groups) {
    const result = classified.get(key) ?? { label: null, tied: [] };
    let setCode = result.label;
    if (!setCode && result.tied.length === 1) setCode = result.tied[0];
    if (!setCode && result.tied.length === 2) {
      const beta = result.tied.find((code) => /beta/i.test(code));
      const retail = result.tied.find((code) => /retail/i.test(code));
      const signature = result.tied.toSorted().join("|");
      const twinKeys = twinGroupKeys.get(signature) ?? [];
      if (beta && retail) {
        if (twinKeys.length === 1) setCode = beta;
        else if (twinKeys.length === 2) setCode = twinKeys[0] === key ? beta : retail;
      }
    }
    setByGroup.set(key, setCode);
    expansions.push({ key, setCode, products: group.length });
  }

  const assignments = new Map<string, PriceAssignment>();
  let pricedProducts = 0;
  let matchedProducts = 0;
  let ambiguousProducts = 0;
  let unknownExpansionProducts = 0;
  const unknownExpansions = new Set<string>();
  const unmatchedSamples: string[] = [];

  const pricedByGroup = new Map<string, CardmarketProduct[]>();
  for (const product of products) {
    const trend = trends.get(product.idProduct);
    if (trend == null) continue;
    pricedProducts += 1;
    const key = expansionKey(product);
    const setCode = setByGroup.get(key) ?? null;
    if (!setCode) {
      unknownExpansionProducts += 1;
      if (product.expansionName) unknownExpansions.add(product.expansionName);
      if (unmatchedSamples.length < 12) unmatchedSamples.push(product.name);
      continue;
    }
    const list = pricedByGroup.get(key) ?? [];
    list.push(product);
    pricedByGroup.set(key, list);
  }

  for (const [key, groupProducts] of pricedByGroup) {
    const setCode = setByGroup.get(key);
    if (!setCode) continue;
    const byName = new Map<string, CardmarketProduct[]>();
    for (const product of groupProducts) {
      const nameKey = productNameKey(product.name);
      const list = byName.get(nameKey) ?? [];
      list.push(product);
      byName.set(nameKey, list);
    }
    for (const [nameKey, namedProducts] of byName) {
      const result = assignNamedProducts(
        namedProducts,
        trends,
        prepared.filter((printing) => printing.setCode === setCode && printing.nameKey === nameKey),
      );
      matchedProducts += result.matched;
      ambiguousProducts += result.ambiguous;
      for (const sample of result.samples) {
        if (unmatchedSamples.length < 12) unmatchedSamples.push(sample);
      }
      for (const assignment of result.assignments) {
        const existing = assignments.get(assignment.printingId);
        if (existing && existing.amount !== assignment.amount) continue;
        assignments.set(assignment.printingId, assignment);
      }
    }
  }

  return {
    assignments: [...assignments.values()],
    products: products.length,
    pricedProducts,
    matchedProducts,
    ambiguousProducts,
    unknownExpansionProducts,
    unknownExpansions: [...unknownExpansions],
    unmatchedSamples,
    expansions,
  };
}

function classifyGroup(
  group: CardmarketProduct[],
  setByName: Map<string, string>,
  namesBySet: Map<string, { names: Set<string>; printings: number }>,
) {
  const labels = [
    ...new Set(group.map((product) => product.expansionName).filter((name): name is string => Boolean(name))),
  ];
  if (labels.length > 0) {
    const codes = new Set<string>();
    for (const label of labels) {
      const normalized = normalizeText(label);
      const code = setByName.get(EXPANSION_ALIASES[normalized] ?? normalized);
      if (code) codes.add(code);
    }
    return { label: codes.size === 1 ? [...codes][0] : null, tied: [] as string[] };
  }

  const names = new Set(group.map((product) => productNameKey(product.name)));
  const ranked: { code: string; intersection: number; precision: number; sizeDelta: number }[] = [];
  for (const [code, local] of namesBySet) {
    if (code.endsWith("-fr") || local.names.size === 0) continue;
    let intersection = 0;
    for (const name of names) {
      if (local.names.has(name)) intersection += 1;
    }
    const recall = intersection / names.size;
    const precision = intersection / local.names.size;
    if (recall < 0.8 || precision < 0.5) continue;
    ranked.push({
      code,
      intersection,
      precision,
      sizeDelta: Math.abs(local.printings - group.length),
    });
  }
  ranked.sort(
    (left, right) =>
      right.intersection - left.intersection ||
      right.precision - left.precision ||
      left.sizeDelta - right.sizeDelta ||
      left.code.localeCompare(right.code),
  );
  const best = ranked[0];
  if (!best) return { label: null, tied: [] as string[] };
  // Jumeaux beta / retail aux mêmes cartes : égalité même si leurs nombres d'impressions diffèrent (variantes),
  // pour que deux extensions Cardmarket se répartissent entre eux au lieu d'aller toutes deux au beta.
  const sameCards = ranked
    .filter((candidate) => candidate.intersection === best.intersection && candidate.precision === best.precision)
    .map((candidate) => candidate.code);
  if (sameCards.length === 2 && sameCards.some((code) => /beta/i.test(code)) && sameCards.some((code) => /retail/i.test(code))) {
    return { label: null, tied: sameCards };
  }
  const tied = ranked
    .filter(
      (candidate) =>
        candidate.intersection === best.intersection &&
        candidate.precision === best.precision &&
        candidate.sizeDelta === best.sizeDelta,
    )
    .map((candidate) => candidate.code);
  return { label: null, tied };
}

function assignNamedProducts(
  products: CardmarketProduct[],
  trends: Map<number, number>,
  locals: (LocalPrinting & { nameKey: string })[],
) {
  const assignments: PriceAssignment[] = [];
  const samples: string[] = [];
  let matched = 0;
  let ambiguous = 0;
  const remainingProducts = [...products];
  const remainingLocals = [...locals];

  for (let index = remainingProducts.length - 1; index >= 0; index -= 1) {
    const product = remainingProducts[index];
    if (!product.number) continue;
    const amount = trends.get(product.idProduct);
    if (amount == null) continue;
    const hits = remainingLocals.filter((printing) => numberMatches(printing.collectorNumber, product.number!));
    if (hits.length !== 1) continue;
    const printing = hits[0];
    remainingProducts.splice(index, 1);
    remainingLocals.splice(remainingLocals.indexOf(printing), 1);
    matched += 1;
    pushAssignment(assignments, printing, amount, product.idProduct);
  }

  const pricedRemaining = remainingProducts
    .map((product) => {
      const amount = trends.get(product.idProduct);
      return amount == null ? null : { product, amount };
    })
    .filter((entry): entry is { product: CardmarketProduct; amount: number } => entry != null)
    .sort(
      (left, right) =>
        left.amount - right.amount || left.product.idProduct - right.product.idProduct,
    );
  const sortedLocals = remainingLocals.sort(
    (left, right) =>
      collectorRank(left.collectorNumber) - collectorRank(right.collectorNumber) ||
      left.collectorNumber.localeCompare(right.collectorNumber, "en", { numeric: true }),
  );

  if (pricedRemaining.length === 1 && sortedLocals.length === 1) {
    matched += 1;
    pushAssignment(assignments, sortedLocals[0], pricedRemaining[0].amount, pricedRemaining[0].product.idProduct);
    return { assignments, matched, ambiguous, samples };
  }

  if (pricedRemaining.length === 0 || sortedLocals.length === 0) {
    ambiguous += pricedRemaining.length;
    for (const entry of pricedRemaining) {
      if (samples.length < 4) samples.push(entry.product.name);
    }
    return { assignments, matched, ambiguous, samples };
  }

  const pairCount = Math.min(pricedRemaining.length, sortedLocals.length);
  const pairedProducts = pickSpread(pricedRemaining, pairCount);
  const pairedLocals = pickSpread(sortedLocals, pairCount);
  for (let index = 0; index < pairCount; index += 1) {
    matched += 1;
    pushAssignment(
      assignments,
      pairedLocals[index],
      pairedProducts[index].amount,
      pairedProducts[index].product.idProduct,
    );
  }
  ambiguous += Math.abs(pricedRemaining.length - sortedLocals.length);
  if (ambiguous > 0) {
    for (const entry of pricedRemaining) {
      if (samples.length < 4) samples.push(entry.product.name);
    }
  }
  return { assignments, matched, ambiguous, samples };
}

function pushAssignment(
  assignments: PriceAssignment[],
  printing: LocalPrinting,
  amount: number,
  productId: number,
) {
  assignments.push({ printingId: printing.id, amount: amount.toFixed(2), productId });
}

function pickSpread<T>(items: T[], count: number) {
  if (count <= 0) return [] as T[];
  if (count === 1) return [items[0]];
  if (count >= items.length) return items;
  const picked: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = Math.round((index * (items.length - 1)) / (count - 1));
    picked.push(items[at]);
  }
  return picked;
}

function collectorRank(value: string) {
  const normalized = value.toLowerCase().replace(/β/g, "b").replace(/\s+/g, "");
  const match = normalized.match(/^(?:b)?0*(\d+)([a-z]*)$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) + (match[2] ? [...match[2]].reduce((sum, char) => sum + char.charCodeAt(0) / 1000, 0) : 0);
}
