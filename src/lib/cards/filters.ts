import {
  ALL_SETS_ID,
  BETA_SET_CODE,
  BOTH_LANGUAGES_SET_ID,
  COLOR_ORDER,
  FRENCH_SET_ID,
  FRENCH_SOURCE_SET_CODE,
  isSealedSetCode,
  isSetList,
  joinSetList,
  parseSetList,
  parseSortKey,
  RARITY_ORDER,
  RELEASED_SET_ID,
  TYPE_ORDER,
} from "@/lib/reference-data";
import type {
  CardDTO,
  CollectionFilter,
  Facets,
  Filters,
  Ownership,
  PrintingDTO,
} from "@/lib/types";
import { isEnglishWelcome, normalizeSetCode, releasedChecklist } from "@/lib/cards/printings";
import { matchesSearch } from "@/lib/cards/search";
import { ownershipOf } from "@/lib/cards/collection-stats";

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

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
