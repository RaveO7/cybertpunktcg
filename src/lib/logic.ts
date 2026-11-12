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
  isSetList,
  joinSetList,
  MAIN_SET_CODE,
  matchesSetFilter,
  parseSetList,
  parseSortKey,
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
// Mêmes ordres que localeCompare(…, "fr"[, { numeric: true }]), sans recréer un comparateur à chaque appel.
const frenchOrder = new Intl.Collator("fr");
const frenchNumericOrder = new Intl.Collator("fr", { numeric: true });

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

/**
 * Liste de l'écran Cartes : beta et retail y sont des cartes distinctes, chacune avec sa
 * propre possession (le résumé fusionné de `releasedChecklist` reste pour les stats).
 */
export function browseChecklist(printings: PrintingDTO[], setId: string) {
  if (setId === ENGLISH_SET_ID) {
    return printings.filter(
      (printing) =>
        (printing.setCode === MAIN_SET_CODE || printing.setCode === BETA_SET_CODE) && printing.language === "en",
    );
  }
  return releasedChecklist(printings, setId);
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
  if (isSetList(set)) {
    const mapped = joinSetList(parseSetList(set).map((code) => setForLanguage(code, language, printings) ?? code));
    return mapped === set ? null : mapped;
  }
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
): string[] {
  if (isSetList(set)) {
    const merged = parseSetList(set).flatMap((code) => languageOptions(code, printings, facetLanguages));
    return [...new Set(merged)];
  }
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
  const list = parseSetList(filters.set).filter((code) => !isSealedSetCode(code));
  if (list.length > 1) {
    // Codes bruts du catalogue : la langue suit les extensions cochées (toutes FR, toutes EN, ou les deux).
    const set = joinSetList(list);
    if (!partial?.set) return { ...filters, set };
    const french = list.filter((code) => code.endsWith("-fr")).length;
    const language = french === list.length ? "fr" : french === 0 ? "en" : "";
    return { ...filters, set, language };
  }
  const rawSet = list.length === 1 ? list[0] : filters.set;
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

/** Texte normalisé d'un tirage (ou d'une carte), découpé une seule fois pour la recherche. */
export type SearchEntry = {
  /** Variantes du nom (nom canonique, nom + sous-titre, nom localisé), normalisées. */
  names: string[];
  nameText: string;
  nameWords: string[];
  /** Extension, tags… : correspondance exacte seulement. */
  otherText: string;
  /** Texte de règles : correspondance exacte seulement. */
  rulesText: string;
  collectorNumber: string | null;
};

function searchEntry(
  names: (string | null | undefined)[],
  other: (string | null | undefined)[],
  rules: (string | null | undefined)[],
  collectorNumber: string | null,
): SearchEntry {
  const normalizedNames = [...new Set(names.filter(Boolean).map((name) => normalizeText(name!)).filter(Boolean))];
  const nameText = normalizedNames.join(" ");
  return {
    names: normalizedNames,
    nameText,
    nameWords: [...new Set(nameText.split(" ").filter(Boolean))],
    otherText: normalizeText(other.filter(Boolean).join(" ")),
    rulesText: normalizeText(rules.filter(Boolean).join(" ")),
    collectorNumber,
  };
}

// Le catalogue garde les mêmes objets d'un rendu à l'autre : l'index est construit une fois par tirage.
const printingEntries = new WeakMap<PrintingDTO, SearchEntry>();
const cardEntries = new WeakMap<CardDTO, SearchEntry>();

export function printingSearchEntry(card: CardDTO, printing: PrintingDTO) {
  let entry = printingEntries.get(printing);
  if (!entry) {
    entry = searchEntry(
      [card.canonicalName, card.name, card.subname ? `${card.name} ${card.subname}` : null, printing.localizedName],
      [printing.setName, printing.setCode],
      [card.rulesText, printing.printedRulesText],
      printing.collectorNumber,
    );
    printingEntries.set(printing, entry);
  }
  return entry;
}

/** Carte sans tirage (navigateur des decks) : tags et mots-clés en correspondance exacte. */
export function cardSearchEntry(card: CardDTO) {
  let entry = cardEntries.get(card);
  if (!entry) {
    entry = searchEntry(
      [card.canonicalName, card.name, card.subname ? `${card.name} ${card.subname}` : null],
      [...card.tags, ...card.keywords],
      [card.rulesText],
      null,
    );
    cardEntries.set(card, entry);
  }
  return entry;
}

/**
 * Distance de Damerau-Levenshtein (transpositions de lettres voisines), bornée :
 * renvoie max + 1 dès que la distance dépasse max.
 */
export function boundedEditDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let before = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[b.length];
}

/** Fautes tolérées : aucune sous 5 caractères, 1 jusqu'à 8, 2 à partir de 9. */
function typoTolerance(word: string) {
  if (word.length < 5) return 0;
  return word.length >= 9 ? 2 : 1;
}

function approximateNameMatch(entry: SearchEntry, word: string) {
  const max = typoTolerance(word);
  if (max === 0 || word.includes(" ")) return false;
  return entry.nameWords.some((nameWord) => boundedEditDistance(word, nameWord, max) <= max);
}

function isNumberToken(token: string) {
  return /^(?:β|b)?\d+[a-z]*$/i.test(token);
}

/** Paliers de pertinence de searchScore. */
export const SEARCH_SCORE = { exactName: 5, namePrefix: 4, inName: 3, approximate: 2, rules: 1 } as const;

/**
 * Pertinence d'une entrée pour la saisie : null si un mot ne correspond pas,
 * sinon 5 nom identique, 4 nom qui commence par la saisie, 3 tous les mots dans le nom,
 * 2 correspondance approchée, 1 texte de règles (ou extension, tags) seulement.
 * Un mot qui ressemble à un numéro est comparé au numéro du tirage et n'influe pas sur le palier.
 */
export function searchScore(entry: SearchEntry, query: string): number | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return SEARCH_SCORE.exactName;
  let approximate = false;
  let outsideName = false;
  const words: string[] = [];
  for (const token of tokens) {
    if (isNumberToken(token)) {
      if (entry.collectorNumber == null || !numberMatches(entry.collectorNumber, token)) return null;
      continue;
    }
    const word = normalizeText(token);
    if (!word) continue;
    words.push(word);
    if (entry.nameText.includes(word)) continue;
    if (approximateNameMatch(entry, word)) {
      approximate = true;
      continue;
    }
    if (entry.otherText.includes(word) || entry.rulesText.includes(word)) {
      outsideName = true;
      continue;
    }
    return null;
  }
  if (outsideName) return SEARCH_SCORE.rules;
  if (approximate) return SEARCH_SCORE.approximate;
  if (words.length === 0) return SEARCH_SCORE.inName;
  const phrase = words.join(" ");
  if (entry.names.includes(phrase)) return SEARCH_SCORE.exactName;
  if (entry.names.some((name) => name.startsWith(phrase))) return SEARCH_SCORE.namePrefix;
  return SEARCH_SCORE.inName;
}

export function matchesSearch(card: CardDTO, printing: PrintingDTO, query: string) {
  if (!query.trim()) return true;
  return searchScore(printingSearchEntry(card, printing), query) !== null;
}

/** Classe par pertinence décroissante ; Array.prototype.sort est stable, l'ordre reçu départage. */
export function rankBySearch<T>(list: T[], query: string, entryOf: (value: T) => SearchEntry | null) {
  if (!query.trim()) return list;
  const scores = new Map<T, number>();
  for (const value of list) {
    const entry = entryOf(value);
    scores.set(value, entry ? (searchScore(entry, query) ?? 0) : 0);
  }
  return [...list].sort((a, b) => scores.get(b)! - scores.get(a)!);
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

/** Valeurs absentes en fin de liste dans les deux sens ; égalités départagées par le numéro. */
function compareValues(a: PrintingDTO, b: PrintingDTO, valueA: number | null, valueB: number | null, direction: 1 | -1) {
  if (valueA == null && valueB == null) return compareNumber(a, b);
  if (valueA == null) return 1;
  if (valueB == null) return -1;
  const diff = (valueA - valueB) * direction;
  if (diff !== 0) return diff;
  return compareNumber(a, b);
}

/** Tris sur une caractéristique de jeu de la carte : [caractéristique, sens]. */
const CARD_STAT_SORTS: Partial<Record<SortKey, ["cost" | "power" | "ram", 1 | -1]>> = {
  "play-cost-asc": ["cost", 1],
  "play-cost-desc": ["cost", -1],
  "power-asc": ["power", 1],
  "power-desc": ["power", -1],
  "ram-asc": ["ram", 1],
  "ram-desc": ["ram", -1],
};

/**
 * Cartes de la liste dont le numéro de collection est entre ceux des deux cartes, bornes incluses et dans
 * n'importe quel ordre ; même ordre que le tri par numéro (#001 à #005a ne prend pas #005b).
 */
export function collectorRangeIds(list: PrintingDTO[], anchorId: string, endId: string) {
  const anchor = list.find((printing) => printing.id === anchorId);
  const end = list.find((printing) => printing.id === endId);
  if (!anchor || !end) return [];
  const [low, high] = compareNumber(anchor, end) <= 0 ? [anchor, end] : [end, anchor];
  return list
    .filter((printing) => compareNumber(printing, low) >= 0 && compareNumber(printing, high) <= 0)
    .map((printing) => printing.id);
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
  /** Saisie en cours et tri par défaut de l'écran : avec ce tri, les résultats sont classés par pertinence. */
  search?: { q: string; defaultSort: SortKey },
) {
  const sorted = sortPrintingsBy(printings, cards, agg, sets, sort);
  if (!search || sort !== search.defaultSort) return sorted;
  return rankBySearch(sorted, search.q, (printing) => {
    const card = cards.get(printing.cardId);
    return card ? printingSearchEntry(card, printing) : null;
  });
}

function sortPrintingsBy(
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
    if (sort === "price-asc" || sort === "price-desc") {
      return compareValues(a, b, marketAmount(a), marketAmount(b), sort === "price-asc" ? 1 : -1);
    }
    const stat = CARD_STAT_SORTS[sort];
    if (stat) {
      const [key, direction] = stat;
      return compareValues(a, b, cards.get(a.cardId)?.[key] ?? null, cards.get(b.cardId)?.[key] ?? null, direction);
    }
    if (sort === "qty-asc" || sort === "qty-desc") {
      const diff = ownershipOf(a.id, agg).qty - ownershipOf(b.id, agg).qty;
      if (diff !== 0) return sort === "qty-asc" ? diff : -diff;
      return compareNumber(a, b);
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
  checklist = releasedChecklist(printings, filters.set),
) {
  const allowed = checklist ? new Set(checklist.map((printing) => printing.id)) : null;
  const setList = isSetList(filters.set) ? new Set(parseSetList(filters.set)) : null;
  const source = checklist ?? printings;
  return source.filter((printing) => {
    const card = cards.get(printing.cardId);
    if (!card) return false;
    if (allowed) {
      if (!allowed.has(printing.id)) return false;
      if (filters.language && printing.language !== filters.language) return false;
    } else if (filters.set === ALL_SETS_ID) {
      if (isSealedSetCode(printing.setCode)) return false;
    } else if (setList) {
      if (!setList.has(printing.setCode)) return false;
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

/** Autres éditions d'une carte (fiche carte), par extension puis par numéro. */
export function siblingPrintings(printings: PrintingDTO[], printing: Pick<PrintingDTO, "id" | "cardId">) {
  return printings
    .filter((entry) => entry.cardId === printing.cardId && entry.id !== printing.id)
    .sort(
      (a, b) =>
        frenchOrder.compare(a.setName, b.setName) || frenchNumericOrder.compare(a.collectorNumber, b.collectorNumber),
    );
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

function languageFromParams(params: URLSearchParams, base: Filters) {
  const rawSet = params.get("set") ?? base.set;
  const rawLanguage = params.get("language");
  if (rawLanguage === "both") return "";
  if (rawLanguage != null) return rawLanguage;
  if (rawSet === FRENCH_SET_ID || rawSet === FRENCH_SOURCE_SET_CODE) return "fr";
  if (rawSet === BOTH_LANGUAGES_SET_ID || rawSet === ALL_SETS_ID) return "";
  return base.language;
}

/**
 * Listes de texte libre (tags, mots-clés, artistes) dans l'URL : valeurs séparées par « , » ;
 * une virgule dans une valeur (« Doe, John ») est doublée. Les anciennes URL, sans « ,, »,
 * se lisent pareil. Les listes à valeurs fixes (couleur, coût…) gardent un découpage simple.
 */
function joinList(values: string[]) {
  return values.map((value) => value.replaceAll(",", ",,")).join(",");
}

function splitList(raw: string) {
  const values: string[] = [];
  let current = "";
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== ",") {
      current += raw[index];
    } else if (raw[index + 1] === ",") {
      current += ",";
      index += 1;
    } else {
      values.push(current);
      current = "";
    }
  }
  values.push(current);
  return values.map((value) => value.trim()).filter(Boolean);
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
  const textList = (key: string) => splitList(params.get(key) ?? "");
  const collection = params.get("collection");
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
    tags: textList("tag"),
    keywords: textList("keyword"),
    costs: list("cost"),
    powers: list("power"),
    rams: list("ram"),
    artists: textList("artist"),
    eddiable: eddiable === "true" || eddiable === "false" ? eddiable : "",
    rarity: params.get("rarity") ?? "",
    // Sans paramètre (ou valeur inconnue) : la préférence « filtre collection » de l'utilisateur.
    collection:
      collection === "all" || collection === "owned" || collection === "missing" || collection === "duplicates"
        ? collection
        : base.collection,
    condition: params.get("condition") ?? "",
    sort: parseSortKey(params.get("sort")) ?? base.sort,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    printingId: params.get("printing"),
  };
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
  if (filters.tags.length) params.set("tag", joinList(filters.tags));
  if (filters.keywords.length) params.set("keyword", joinList(filters.keywords));
  if (filters.costs.length) params.set("cost", filters.costs.join(","));
  if (filters.powers.length) params.set("power", filters.powers.join(","));
  if (filters.rams.length) params.set("ram", filters.rams.join(","));
  if (filters.artists.length) params.set("artist", joinList(filters.artists));
  set("eddiable", filters.eddiable);
  set("rarity", filters.rarity);
  set("collection", filters.collection, defaults.collection);
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
