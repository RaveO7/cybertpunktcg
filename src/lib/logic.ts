import {
  ALL_SETS_ID,
  BETA_SET_CODE,
  BOTH_LANGUAGES_SET_ID,
  COLOR_ORDER,
  ENGLISH_SET_ID,
  ENGLISH_SET_NAME,
  FRENCH_SET_ID,
  FRENCH_SET_NAME,
  FRENCH_SOURCE_SET_CODE,
  isSealedSetCode,
  MAIN_SET_CODE,
  matchesSetFilter,
  RARITY_ORDER,
  RELEASED_SET_ID,
  TYPE_ORDER,
} from "./reference-data";
import type {
  CardDTO,
  CollectionFilter,
  CollectionItemDTO,
  Facets,
  Filters,
  Ownership,
  PrintingDTO,
  Progress,
  SetDTO,
  SortKey,
} from "./types";

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function baseCollectorNumber(value: string) {
  return value.replace(/^β/iu, "");
}

export function printingIdentity(printing: Pick<PrintingDTO, "cardId" | "collectorNumber" | "language">) {
  return `${printing.language}|${printing.cardId}|${baseCollectorNumber(printing.collectorNumber)}`;
}

export function isReleasedSet(setId: string) {
  return (
    setId === RELEASED_SET_ID ||
    setId === ENGLISH_SET_ID ||
    setId === FRENCH_SET_ID ||
    setId === BOTH_LANGUAGES_SET_ID
  );
}

export function extensionValue(set: string) {
  if (set === FRENCH_SOURCE_SET_CODE || set === FRENCH_SET_ID) return MAIN_SET_CODE;
  return set;
}

export function normalizeSetCode(setId: string) {
  if (setId === RELEASED_SET_ID || setId === BOTH_LANGUAGES_SET_ID) return ENGLISH_SET_ID;
  if (setId === FRENCH_SET_ID) return FRENCH_SOURCE_SET_CODE;
  return setId;
}

function presentReleased(printing: PrintingDTO, setId: string, setName: string): PrintingDTO {
  return { ...printing, setCode: setId, setName };
}

export function englishChecklist(printings: PrintingDTO[]) {
  const retail = printings.filter((printing) => printing.setCode === MAIN_SET_CODE && printing.language === "en");
  const beta = printings.filter((printing) => printing.setCode === BETA_SET_CODE && printing.language === "en");
  const retailKeys = new Set(retail.map(printingIdentity));
  const extras = beta.filter((printing) => !retailKeys.has(printingIdentity(printing)));
  return [...retail, ...extras].map((printing) => presentReleased(printing, ENGLISH_SET_ID, ENGLISH_SET_NAME));
}

export function frenchChecklist(printings: PrintingDTO[]) {
  return printings
    .filter((printing) => printing.setCode === FRENCH_SOURCE_SET_CODE)
    .map((printing) => presentReleased(printing, FRENCH_SET_ID, FRENCH_SET_NAME));
}

export function releasedChecklist(printings: PrintingDTO[], setId: string) {
  if (setId === ENGLISH_SET_ID) return englishChecklist(printings);
  if (setId === FRENCH_SET_ID) return frenchChecklist(printings);
  if (setId === RELEASED_SET_ID || setId === BOTH_LANGUAGES_SET_ID) {
    return [...englishChecklist(printings), ...frenchChecklist(printings)];
  }
  return null;
}

export function equivalentPrintingIds(printing: Pick<PrintingDTO, "cardId" | "collectorNumber" | "language">, all: PrintingDTO[]) {
  const key = printingIdentity(printing);
  return all.filter((item) => printingIdentity(item) === key).map((item) => item.id);
}

function ownershipPool(setId: string, printings: PrintingDTO[]) {
  if (setId === ENGLISH_SET_ID) {
    return printings.filter(
      (printing) => printing.setCode === MAIN_SET_CODE || printing.setCode === BETA_SET_CODE,
    );
  }
  if (setId === FRENCH_SET_ID) {
    return printings.filter((printing) => printing.setCode === FRENCH_SOURCE_SET_CODE);
  }
  return printings;
}

export function viewOwnership(setId: string, printings: PrintingDTO[], agg: Map<string, Ownership>) {
  const checklist = releasedChecklist(printings, setId);
  if (!checklist) return agg;
  return mergeEquivalentOwnership(checklist, ownershipPool(setId, printings), agg);
}

export function mergeEquivalentOwnership(
  checklist: PrintingDTO[],
  all: PrintingDTO[],
  agg: Map<string, Ownership>,
) {
  const idsByIdentity = new Map<string, string[]>();
  for (const printing of all) {
    const key = printingIdentity(printing);
    const ids = idsByIdentity.get(key) ?? [];
    ids.push(printing.id);
    idsByIdentity.set(key, ids);
  }
  const merged = new Map(agg);
  for (const printing of checklist) {
    const ids = idsByIdentity.get(printingIdentity(printing)) ?? [printing.id];
    const combined: Ownership = { qty: 0, conditions: [] };
    for (const id of ids) {
      const owned = agg.get(id);
      if (!owned) continue;
      combined.qty += owned.qty;
      for (const condition of owned.conditions) {
        if (!combined.conditions.includes(condition)) combined.conditions.push(condition);
      }
    }
    if (combined.qty > 0) merged.set(printing.id, combined);
  }
  return merged;
}

function isEnglishWelcome(set: string) {
  return set === ENGLISH_SET_ID || set === MAIN_SET_CODE || set === BETA_SET_CODE;
}

export function setForLanguage(
  set: string,
  language: string,
  printings: Pick<PrintingDTO, "setCode">[],
) {
  if (!language || set === ALL_SETS_ID) return null;
  const codes = new Set(printings.map((printing) => printing.setCode));
  if (language === "fr") {
    if (isEnglishWelcome(set)) return codes.has(FRENCH_SOURCE_SET_CODE) ? FRENCH_SOURCE_SET_CODE : null;
    if (set.endsWith("-fr")) return null;
    const twin = `${set}-fr`;
    return codes.has(twin) ? twin : null;
  }
  if (language === "en") {
    if (set === FRENCH_SOURCE_SET_CODE || set === FRENCH_SET_ID) return MAIN_SET_CODE;
    if (!set.endsWith("-fr")) return null;
    const base = set.slice(0, -3);
    return codes.has(base) ? base : null;
  }
  return null;
}

export function languageOptions(
  set: string,
  printings: Pick<PrintingDTO, "setCode" | "language">[],
  facetLanguages: string[],
) {
  const codes = new Set(printings.map((printing) => printing.setCode));
  const options = new Set(facetLanguages);
  if (isEnglishWelcome(set) || set === FRENCH_SOURCE_SET_CODE || set === FRENCH_SET_ID) {
    if (codes.has(BETA_SET_CODE) || codes.has(MAIN_SET_CODE)) options.add("en");
    if (codes.has(FRENCH_SOURCE_SET_CODE)) options.add("fr");
  } else if (set.endsWith("-fr")) {
    options.add("fr");
    if (codes.has(set.slice(0, -3))) options.add("en");
  } else if (isSealedSetCode(set)) {
    options.add("en");
    options.add("fr");
  } else if (set !== ALL_SETS_ID && codes.has(`${set}-fr`)) {
    options.add("en");
    options.add("fr");
  }
  const preferred = ["en", "fr"].filter((language) => options.has(language));
  const extra = [...options].filter((language) => language !== "en" && language !== "fr").sort();
  return [...preferred, ...extra];
}

export function alignReleasedFilters(filters: Filters, partial?: Partial<Filters>): Filters {
  const rawSet = filters.set;
  let set = normalizeSetCode(rawSet);
  let language = filters.language;
  if ((rawSet === RELEASED_SET_ID || rawSet === BOTH_LANGUAGES_SET_ID) && language === "fr") {
    set = FRENCH_SOURCE_SET_CODE;
  }
  if (set.endsWith("-fr")) language = "fr";
  else if (isEnglishWelcome(set)) language = "en";
  else if (isSealedSetCode(set)) language = sealedLanguage(language);
  else if (partial?.set === ALL_SETS_ID) language = "";
  else if (partial?.set) language = "en";
  return { ...filters, set, language };
}

export function defaultFilters(
  hasMainSet = true,
  prefs?: Partial<Pick<Filters, "sort" | "collection">>,
): Filters {
  return {
    q: "",
    language: hasMainSet ? "en" : "",
    set: hasMainSet ? BETA_SET_CODE : ALL_SETS_ID,
    colors: [],
    types: [],
    tags: [],
    keywords: [],
    costs: [],
    powers: [],
    rams: [],
    artists: [],
    eddiable: "",
    rarity: "",
    collection: prefs?.collection ?? "all",
    condition: "",
    sort: prefs?.sort ?? "number-asc",
    page: 1,
    printingId: null,
  };
}

/** Les produits scellés existent en anglais et en français ; anglais par défaut. */
function sealedLanguage(language: string | undefined) {
  return language === "fr" ? "fr" : "en";
}

/** Remet les filtres « carte » à zéro pour naviguer dans une catégorie scellée. */
export function sealedBrowseFilters(setCode: string, partial: Partial<Filters> = {}): Filters {
  return {
    ...defaultFilters(true),
    ...partial,
    set: setCode,
    language: sealedLanguage(partial.language),
    colors: [],
    types: [],
    tags: [],
    keywords: [],
    costs: [],
    powers: [],
    rams: [],
    artists: [],
    eddiable: "",
    rarity: "",
    sort: partial.sort ?? "name-asc",
    page: partial.page ?? 1,
    printingId: null,
  };
}

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

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/β/g, "b")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberParts(value: string) {
  const normalized = value.toLowerCase().replace(/β/g, "b").replace(/\s+/g, "");
  const match = normalized.match(/^(?:b)?0*(\d+)([a-z]*)$/);
  if (!match) return null;
  return { n: Number(match[1]), suffix: match[2] ?? "" };
}

export function numberMatches(collectorNumber: string, token: string) {
  const query = token.trim().toLowerCase().replace(/β/g, "b");
  if (!query) return false;
  const card = numberParts(collectorNumber);
  const wanted = numberParts(query);
  if (wanted) {
    if (!card || card.n !== wanted.n) return false;
    return !wanted.suffix || card.suffix === wanted.suffix;
  }
  const compactCard = collectorNumber.toLowerCase().replace(/β/g, "b").replace(/\s+/g, "");
  return compactCard.includes(query.replace(/\s+/g, ""));
}

function haystack(card: CardDTO, printing: PrintingDTO) {
  return normalizeText(
    [
      card.canonicalName,
      card.name,
      card.subname,
      printing.localizedName,
      printing.setName,
      printing.setCode,
      card.rulesText,
      printing.printedRulesText,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function tokenMatches(card: CardDTO, printing: PrintingDTO, token: string) {
  const trimmed = token.trim();
  if (!trimmed) return true;
  if (/^(?:β|b)?\d+[a-z]*$/i.test(trimmed)) {
    return numberMatches(printing.collectorNumber, trimmed);
  }
  return haystack(card, printing).includes(normalizeText(trimmed));
}

export function matchesSearch(card: CardDTO, printing: PrintingDTO, query: string) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => tokenMatches(card, printing, token));
}

function matchesCollection(owned: Ownership, filter: CollectionFilter) {
  switch (filter) {
    case "owned":
      return owned.qty >= 1;
    case "missing":
      return owned.qty === 0;
    case "duplicates":
      return owned.qty > 1;
    default:
      return true;
  }
}

function rank(order: readonly string[], value: string | null) {
  if (!value) return order.length + 1;
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

function collectorRank(value: string) {
  const beta = /^β/i.test(value) ? 1 : 0;
  const match = value.match(/(\d+)/);
  const number = match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  return { beta, number, value };
}

function displayName(card: CardDTO, printing: PrintingDTO) {
  return printing.localizedName || card.canonicalName || card.name;
}

function compareDefault(a: PrintingDTO, b: PrintingDTO, cards: Map<string, CardDTO>) {
  const cardA = cards.get(a.cardId);
  const cardB = cards.get(b.cardId);
  const color = rank(COLOR_ORDER, cardA?.color ?? null) - rank(COLOR_ORDER, cardB?.color ?? null);
  if (color !== 0) return color;
  const type = rank(TYPE_ORDER, cardA?.cardType ?? null) - rank(TYPE_ORDER, cardB?.cardType ?? null);
  if (type !== 0) return type;
  const cost = (cardA?.cost ?? 0) - (cardB?.cost ?? 0);
  if (cost !== 0) return cost;
  const name = collator.compare(displayName(cardA ?? emptyCard(a.cardId), a), displayName(cardB ?? emptyCard(b.cardId), b));
  if (name !== 0) return name;
  return compareNumber(a, b);
}

function compareNumber(a: PrintingDTO, b: PrintingDTO) {
  const left = collectorRank(a.collectorNumber);
  const right = collectorRank(b.collectorNumber);
  if (left.beta !== right.beta) return left.beta - right.beta;
  if (left.number !== right.number) return left.number - right.number;
  return collator.compare(left.value, right.value);
}

/** Prix Cardmarket actuel (même valeur que le modal aria-live), nulls en fin de liste. */
function marketAmount(printing: PrintingDTO) {
  if (printing.marketPrice == null || printing.marketPrice === "") return null;
  const amount = Number(printing.marketPrice);
  return Number.isFinite(amount) ? amount : null;
}

function compareMarketPrice(a: PrintingDTO, b: PrintingDTO, direction: 1 | -1) {
  const priceA = marketAmount(a);
  const priceB = marketAmount(b);
  if (priceA == null && priceB == null) return compareNumber(a, b);
  if (priceA == null) return 1;
  if (priceB == null) return -1;
  const diff = (priceA - priceB) * direction;
  if (diff !== 0) return diff;
  return compareNumber(a, b);
}

function emptyCard(id: string): CardDTO {
  return {
    id,
    externalId: "",
    slug: "",
    name: "",
    subname: null,
    canonicalName: "",
    rulesText: null,
    flavorText: null,
    color: null,
    cardType: null,
    isEddiable: null,
    cost: null,
    power: null,
    ram: null,
    tags: [],
    keywords: [],
  };
}

export function sortPrintings(
  printings: PrintingDTO[],
  cards: Map<string, CardDTO>,
  agg: Map<string, Ownership>,
  sets: Map<string, SetDTO>,
  sort: SortKey,
) {
  const list = [...printings];
  list.sort((a, b) => {
    if (sort === "owned-first" || sort === "missing-first") {
      const ownedA = ownershipOf(a.id, agg).qty > 0 ? 1 : 0;
      const ownedB = ownershipOf(b.id, agg).qty > 0 ? 1 : 0;
      const diff = sort === "owned-first" ? ownedB - ownedA : ownedA - ownedB;
      if (diff !== 0) return diff;
      return compareDefault(a, b, cards);
    }
    if (sort === "number-asc") return compareNumber(a, b);
    if (sort === "number-desc") return compareNumber(b, a);
    if (sort === "cost-asc" || sort === "cost-desc") {
      return compareMarketPrice(a, b, sort === "cost-asc" ? 1 : -1);
    }
    if (sort === "name-asc" || sort === "name-desc") {
      const cardA = cards.get(a.cardId) ?? emptyCard(a.cardId);
      const cardB = cards.get(b.cardId) ?? emptyCard(b.cardId);
      const diff = collator.compare(displayName(cardA, a), displayName(cardB, b));
      return sort === "name-asc" ? diff : -diff;
    }
    if (sort === "rarity") {
      const diff = rank(RARITY_ORDER, a.rarity) - rank(RARITY_ORDER, b.rarity);
      if (diff !== 0) return diff;
      return compareNumber(a, b);
    }
    if (sort === "set") {
      const setA = sets.get(a.setCode)?.sortOrder ?? 999;
      const setB = sets.get(b.setCode)?.sortOrder ?? 999;
      if (setA !== setB) return setA - setB;
      return compareNumber(a, b);
    }
    return compareDefault(a, b, cards);
  });
  return list;
}

export function filterPrintings(
  printings: PrintingDTO[],
  cards: Map<string, CardDTO>,
  agg: Map<string, Ownership>,
  filters: Filters,
) {
  const checklist = releasedChecklist(printings, filters.set);
  const allowed = checklist ? new Set(checklist.map((printing) => printing.id)) : null;
  const source = checklist ?? printings;
  return source.filter((printing) => {
    const card = cards.get(printing.cardId);
    if (!card) return false;
    if (allowed) {
      if (!allowed.has(printing.id)) return false;
      if (filters.language && printing.language !== filters.language) return false;
    } else if (filters.set === ALL_SETS_ID) {
      if (isSealedSetCode(printing.setCode)) return false;
    } else if (filters.set && printing.setCode !== filters.set) {
      return false;
    }
    if (!allowed && filters.language && printing.language !== filters.language) return false;
    if (filters.colors.length > 0 && !filters.colors.includes(card.color ?? "")) return false;
    if (filters.types.length > 0 && !filters.types.includes(card.cardType ?? "")) return false;
    if (filters.tags.length > 0 && !filters.tags.some((tag) => card.tags.includes(tag))) return false;
    if (filters.keywords.length > 0 && !filters.keywords.some((keyword) => card.keywords.includes(keyword))) {
      return false;
    }
    if (filters.costs.length > 0 && !filters.costs.includes(card.cost == null ? "" : String(card.cost))) {
      return false;
    }
    if (filters.powers.length > 0 && !filters.powers.includes(card.power == null ? "" : String(card.power))) {
      return false;
    }
    if (filters.rams.length > 0 && !filters.rams.includes(card.ram == null ? "" : String(card.ram))) {
      return false;
    }
    if (filters.eddiable === "true" && card.isEddiable !== true) return false;
    if (filters.eddiable === "false" && card.isEddiable !== false) return false;
    if (filters.artists.length > 0 && !filters.artists.includes(printing.artist ?? "")) return false;
    if (filters.rarity && (printing.rarity ?? "Inconnue") !== filters.rarity) return false;
    const owned = ownershipOf(printing.id, agg);
    if (!matchesCollection(owned, filters.collection)) return false;
    if (filters.condition && !owned.conditions.includes(filters.condition)) return false;
    if (!matchesSearch(card, printing, filters.q)) return false;
    return true;
  });
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

function orderedValues(order: readonly string[], values: Iterable<string>) {
  const present = new Set(values);
  const known = order.filter((value) => present.has(value));
  const extra = [...present].filter((value) => !order.includes(value)).sort((a, b) => collator.compare(a, b));
  return [...known, ...extra];
}

export function buildFacets(
  printings: PrintingDTO[],
  cards: Map<string, CardDTO>,
): Facets {
  const languages = new Set<string>();
  const colors = new Set<string>();
  const types = new Set<string>();
  const tags = new Set<string>();
  const keywords = new Set<string>();
  const costs = new Set<string>();
  const powers = new Set<string>();
  const rams = new Set<string>();
  const artists = new Set<string>();
  const rarities = new Set<string>();
  let eddiable = false;
  for (const printing of printings) {
    languages.add(printing.language);
    if (printing.rarity) rarities.add(printing.rarity);
    if (printing.artist) artists.add(printing.artist);
    const card = cards.get(printing.cardId);
    if (!card) continue;
    if (card.color) colors.add(card.color);
    if (card.cardType) types.add(card.cardType);
    for (const tag of card.tags) tags.add(tag);
    for (const keyword of card.keywords) keywords.add(keyword);
    if (card.cost != null) costs.add(String(card.cost));
    if (card.power != null) powers.add(String(card.power));
    if (card.ram != null) rams.add(String(card.ram));
    if (card.isEddiable != null) eddiable = true;
  }
  const numeric = (values: Set<string>) =>
    [...values].sort((a, b) => Number(a) - Number(b));
  return {
    languages: [...languages].sort(),
    colors: orderedValues(COLOR_ORDER, colors),
    types: orderedValues(TYPE_ORDER, types),
    tags: [...tags].sort((a, b) => collator.compare(a, b)),
    keywords: [...keywords].sort((a, b) => collator.compare(a, b)),
    costs: numeric(costs),
    powers: numeric(powers),
    rams: numeric(rams),
    artists: [...artists].sort((a, b) => collator.compare(a, b)),
    rarities: orderedValues(RARITY_ORDER, rarities),
    eddiable,
  };
}

export function printingTitle(card: CardDTO | undefined, printing: PrintingDTO) {
  return printing.localizedName || card?.canonicalName || card?.name || "Carte";
}

/** Prefers official printed rules in the UI locale, falling back to the current printing / English card text. */
export function resolveRulesText(
  card: CardDTO,
  printing: PrintingDTO,
  siblings: PrintingDTO[],
  locale: string,
): { text: string; language: string | null; fromOtherPrinting: boolean } {
  const all = [printing, ...siblings];
  const preferred = all.find((entry) => entry.language === locale && entry.printedRulesText?.trim());
  if (preferred?.printedRulesText) {
    return {
      text: preferred.printedRulesText,
      language: preferred.language,
      fromOtherPrinting: preferred.id !== printing.id,
    };
  }

  if (printing.printedRulesText?.trim()) {
    return {
      text: printing.printedRulesText,
      language: printing.language,
      fromOtherPrinting: false,
    };
  }

  if (card.rulesText?.trim()) {
    return {
      text: card.rulesText,
      language: "en",
      fromOtherPrinting: false,
    };
  }

  const anyPrinted = siblings.find((entry) => entry.printedRulesText?.trim());
  if (anyPrinted?.printedRulesText) {
    return {
      text: anyPrinted.printedRulesText,
      language: anyPrinted.language,
      fromOtherPrinting: true,
    };
  }

  return { text: "", language: null, fromOtherPrinting: false };
}


export function formatPercent(value: number, digits = 0) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)} %`;
}

export function formatInt(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
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

export type PriceMovement = "up" | "down" | "flat" | "none";

export function priceMovement(current: number | null, previous: number | null): PriceMovement {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return "none";
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return "flat";
  return delta > 0 ? "up" : "down";
}

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
  profit: number | null;
  marketDelta: PriceMovement;
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
  profitLines: number;
};

export type InvestmentSummary = {
  marketTotal: number;
  previousMarketTotal: number | null;
  marketDelta: PriceMovement;
  marketDeltaAmount: number | null;
  investedEur: number;
  profitEur: number | null;
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
      profit,
      marketDelta: priceMovement(marketUnit, previousMarketUnit),
    });
  }
  return lines.sort(
    (left, right) =>
      left.setName.localeCompare(right.setName, "fr") ||
      left.collectorNumber.localeCompare(right.collectorNumber, "fr", { numeric: true }) ||
      left.title.localeCompare(right.title, "fr"),
  );
}

/**
 * Ramène chaque ligne à une période : la variation marché part du prix de référence
 * au début de la période, et le P&L aussi — sauf pour une ligne ajoutée pendant la
 * période, dont le P&L reste calculé depuis son prix d'achat. Seules les lignes avec
 * un prix d'achat ont un P&L.
 * `startDay` nul = toute la période (P&L d'achat inchangé).
 */
export function applyInvestmentPeriod(
  lines: InvestmentLine[],
  referencePrices: Readonly<Record<string, number>>,
  startDay: string | null,
  addedAtById: ReadonlyMap<string, string>,
): InvestmentLine[] {
  return lines.map((line) => {
    const reference = referencePrices[line.printingId];
    const previousMarketUnit = reference != null && Number.isFinite(reference) ? reference : null;
    let profit = line.profit;
    // Pas de prix d'achat (EUR) = pas de P&L, quelle que soit la période.
    if (startDay != null && line.profit != null) {
      const addedDay = addedAtById.get(line.itemId)?.slice(0, 10);
      const addedDuringPeriod = addedDay != null && addedDay > startDay;
      if (!addedDuringPeriod) {
        profit =
          line.marketUnit == null || previousMarketUnit == null
            ? null
            : (line.marketUnit - previousMarketUnit) * line.quantity;
      }
    }
    return {
      ...line,
      previousMarketUnit,
      profit,
      marketDelta: priceMovement(line.marketUnit, previousMarketUnit),
    };
  });
}

export function summarizeInvestment(lines: InvestmentLine[]): InvestmentSummary {
  let marketTotal = 0;
  let previousMarketTotal = 0;
  let compared = false;
  let investedEur = 0;
  let profitEur = 0;
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
    if (filters.performance === "profit" && !(line.profit != null && line.profit > 0.004)) return false;
    if (filters.performance === "loss" && !(line.profit != null && line.profit < -0.004)) return false;
    if (filters.performance === "flat" && !(line.profit != null && Math.abs(line.profit) <= 0.004)) return false;
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

function languageFromParams(params: URLSearchParams, base: Filters) {
  const rawSet = params.get("set") ?? base.set;
  const rawLanguage = params.get("language");
  if (rawLanguage === "both") return "";
  if (rawLanguage != null) return rawLanguage;
  if (rawSet === FRENCH_SET_ID || rawSet === FRENCH_SOURCE_SET_CODE) return "fr";
  if (rawSet === BOTH_LANGUAGES_SET_ID || rawSet === ALL_SETS_ID) return "";
  return base.language;
}

export function parseFilters(
  params: URLSearchParams,
  hasMainSet = true,
  prefs?: Partial<Pick<Filters, "sort" | "collection">>,
): Filters {
  const base = defaultFilters(hasMainSet, prefs);
  const list = (key: string) =>
    (params.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  const collection = params.get("collection");
  const sort = params.get("sort");
  const eddiable = params.get("eddiable");
  const page = Number(params.get("page") ?? "1");
  const language = languageFromParams(params, base);
  const rawSet = params.get("set") ?? base.set;
  const set =
    (rawSet === RELEASED_SET_ID || rawSet === BOTH_LANGUAGES_SET_ID) && language === "fr"
      ? FRENCH_SOURCE_SET_CODE
      : normalizeSetCode(rawSet);
  return {
    ...base,
    q: params.get("q") ?? "",
    language,
    set,
    colors: list("color"),
    types: list("type"),
    tags: list("tag"),
    keywords: list("keyword"),
    costs: list("cost"),
    powers: list("power"),
    rams: list("ram"),
    artists: list("artist"),
    eddiable: eddiable === "true" || eddiable === "false" ? eddiable : "",
    rarity: params.get("rarity") ?? "",
    collection:
      collection === "owned" || collection === "missing" || collection === "duplicates" ? collection : "all",
    condition: params.get("condition") ?? "",
    sort: isSortKey(sort) ? sort : base.sort,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    printingId: params.get("printing"),
  };
}

function isSortKey(value: string | null): value is SortKey {
  return (
    value === "default" ||
    value === "number-asc" ||
    value === "number-desc" ||
    value === "cost-asc" ||
    value === "cost-desc" ||
    value === "name-asc" ||
    value === "name-desc" ||
    value === "rarity" ||
    value === "set" ||
    value === "owned-first" ||
    value === "missing-first"
  );
}

export function serializeFilters(
  filters: Filters,
  hasMainSet = true,
  prefs?: Partial<Pick<Filters, "sort" | "collection">>,
) {
  const defaults = defaultFilters(hasMainSet, prefs);
  const params = new URLSearchParams();
  const set = (key: string, value: string, fallback = "") => {
    if (value && value !== fallback) params.set(key, value);
  };
  set("q", filters.q);
  if (filters.language !== defaults.language) params.set("language", filters.language || "both");
  set("set", filters.set, defaults.set);
  if (filters.colors.length) params.set("color", filters.colors.join(","));
  if (filters.types.length) params.set("type", filters.types.join(","));
  if (filters.tags.length) params.set("tag", filters.tags.join(","));
  if (filters.keywords.length) params.set("keyword", filters.keywords.join(","));
  if (filters.costs.length) params.set("cost", filters.costs.join(","));
  if (filters.powers.length) params.set("power", filters.powers.join(","));
  if (filters.rams.length) params.set("ram", filters.rams.join(","));
  if (filters.artists.length) params.set("artist", filters.artists.join(","));
  set("eddiable", filters.eddiable);
  set("rarity", filters.rarity);
  set("collection", filters.collection, "all");
  set("condition", filters.condition);
  set("sort", filters.sort, defaults.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.printingId) params.set("printing", filters.printingId);
  return params;
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
