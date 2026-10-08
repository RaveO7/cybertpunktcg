import { baseCollectorNumber, numberMatches, normalizeText } from "./logic";

export type CardmarketProduct = {
  idProduct: number;
  name: string;
  expansionName: string | null;
  idExpansion: number | null;
  number: string | null;
};

export type LocalSet = { code: string; name: string };

export type LocalPrinting = {
  id: string;
  setCode: string;
  collectorNumber: string;
  name: string;
};

export type PriceAssignment = {
  printingId: string;
  amount: string;
  productId: number;
};

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

export type MatchReport = {
  assignments: PriceAssignment[];
  products: number;
  pricedProducts: number;
  matchedProducts: number;
  ambiguousProducts: number;
  unknownExpansionProducts: number;
  unknownExpansions: string[];
  unmatchedSamples: string[];
  expansions: { key: string; setCode: string | null; products: number }[];
};

export const EXPANSION_ALIASES: Record<string, string> = {
  "the heist demo deck": "merc demo deck",
  "embracing power demo deck": "arasaka demo deck",
};

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

export function productNameKey(name: string) {
  return normalizeText(name.replace(/\(\s*v\.?\s*\d+\s*\)/gi, " "));
}

export function parseProductFile(text: string) {
  const data = parseFile(text);
  if (Array.isArray(data) || isRecord(data)) return parseProducts(data);
  throw new Error("Catalogue produits illisible.");
}

export function parsePriceFile(text: string) {
  return parseTrends(parseFile(text));
}

/** Date `createdAt` en tête du guide de prix Cardmarket, ou null si absente. */
export function parsePriceGuideDate(text: string) {
  const match = /"createdAt"\s*:\s*"([^"]+)"/.exec(text.slice(0, 1000));
  if (!match) return null;
  const date = new Date(match[1].replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseProducts(data: unknown): CardmarketProduct[] {
  const rows = rowsOf(data, ["products", "product"]);
  if (!rows) throw new Error("Catalogue produits illisible.");
  const products: CardmarketProduct[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const idProduct = readId(record);
    const name = readString(record, ["name", "Name", "enName"]);
    if (idProduct == null || !name) continue;
    products.push({
      idProduct,
      name,
      expansionName: readExpansionName(record),
      idExpansion: readExpansionId(record),
      number: readCollectorNumber(record, name),
    });
  }
  return products;
}

export function parseTrends(data: unknown) {
  const rows = rowsOf(data, ["priceGuides", "priceguides", "prices"]);
  if (!rows) throw new Error("Guide de prix illisible.");
  const trends = new Map<number, number>();
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const idProduct = readId(record);
    if (idProduct == null) continue;
    const amount = pickMarketAmount(record);
    if (amount == null) continue;
    trends.set(idProduct, amount);
  }
  return trends;
}

function pickMarketAmount(record: Record<string, unknown>) {
  return (
    readEuro(record.trend ?? record["Trend Price"] ?? record.trendPrice ?? record.TREND) ??
    readEuro(record.low ?? record["Low Price"] ?? record.lowPrice ?? record.LOW) ??
    readEuro(record.avg ?? record["Avg. Sell Price"] ?? record.avgSellPrice ?? record.AVG ?? record.SELL)
  );
}

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
    const result = classifyGroup(group, setByName, namesBySet);
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

function expansionKey(product: CardmarketProduct) {
  if (product.idExpansion != null) return `id:${product.idExpansion}`;
  if (product.expansionName) return `name:${normalizeText(product.expansionName)}`;
  return `product:${product.idProduct}`;
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

function parseFile(text: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed) as unknown;
  return csvRecords(trimmed);
}

function csvRecords(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

/** Lit un CSV (séparateur « ; », « , » ou tabulation détecté sur l'en-tête, guillemets doublés). */
export function parseCsv(text: string) {
  const header = text.slice(0, 2000).split(/\r?\n/, 1)[0];
  const count = (char: string) => header.split(char).length - 1;
  const delimiter = [";", "\t"].reduce((best, char) => (count(char) > count(best) ? char : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function rowsOf(data: unknown, keys: string[]) {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return null;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
}

function readExpansionName(record: Record<string, unknown>) {
  const direct = readString(record, ["expansionName", "Expansion", "expansion"]);
  if (direct) return direct;
  const expansion = asRecord(record.expansion);
  const nested = expansion ? readString(expansion, ["enName", "name"]) : null;
  if (nested) return nested;
  const website = readString(record, ["website", "url"]);
  const match = website?.match(/\/Singles\/([^/]+)/i);
  return match ? match[1].replace(/-/g, " ") : null;
}

function readExpansionId(record: Record<string, unknown>) {
  const value = record.idExpansion ?? record["Expansion ID"] ?? record.expansionId;
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

function readCollectorNumber(record: Record<string, unknown>, name: string) {
  const raw = readString(record, ["number", "Number", "collectorNumber"]);
  const cleaned = raw ? cleanCollectorNumber(raw) : null;
  if (cleaned) return cleaned;
  const match = name.match(/\(\s*((?:β|b)?\d+[a-z]*)\s*\)\s*$/i);
  if (!match || /^v/i.test(match[1])) return null;
  return match[1];
}

function cleanCollectorNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^(ms|sd|prm|prmb|prr|dd|alpha)\d/i.test(trimmed)) return null;
  return trimmed;
}

function readId(record: Record<string, unknown>) {
  const value = record.idProduct ?? record.idproduct ?? record["idProduct"];
  // Number("") vaut 0 : une cellule vide n'est pas un id produit.
  const id =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function readEuro(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(/\s/g, "").replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100) / 100;
  // Filtré après l'arrondi : 0,004 € deviendrait un prix de 0 €, qui signifie « pas de prix ».
  return rounded > 0 ? rounded : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) != null;
}
