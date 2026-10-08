// Export / import CSV de la collection. Partagé client/serveur : pas de Zod ni de Prisma ici.
// L'import accepte l'export de l'application, un tableur « maison » (en-têtes FR/EN usuels)
// et les exports Cardmarket (stock ou achats, séparateur « ; »).
import { EXPANSION_ALIASES, parseCsv, productNameKey } from "./cardmarket";
import { normalizeText, numberMatches } from "./logic";
import { CURRENCIES } from "./parse";
import { CONDITIONS, isSealedSetCode } from "./reference-data";
import type { CatalogDTO, CollectionItemDTO, PrintingDTO } from "./types";

/** Lignes (carte × état) maximum par import. */
export const MAX_IMPORT_LINES = 5000;

export const CSV_HEADERS = [
  "set_code",
  "set_name",
  "collector_number",
  "language",
  "name",
  "rarity",
  "condition",
  "quantity",
  "purchase_price",
  "purchase_currency",
  "notes",
  "printing_id",
] as const;

export type ImportLine = {
  printingId: string;
  conditionCode: string;
  quantity: number;
  notes?: string;
  purchasePrice?: string;
  purchaseCurrency?: string;
};

export type ImportIssueReason = "unknown-card" | "bad-quantity" | "no-identity";

export type ImportIssue = { row: number; label: string; reason?: ImportIssueReason };

export type ImportFormat = "app" | "cardmarket" | "generic";

export type ImportPreview = {
  format: ImportFormat;
  /** Lignes de données lues dans le fichier. */
  rows: number;
  /** Lignes fusionnées par carte × état, prêtes à envoyer. */
  lines: ImportLine[];
  copies: number;
  /** Lignes reconnues mais choisies parmi plusieurs tirages possibles (à vérifier). */
  guessed: ImportIssue[];
  rejected: ImportIssue[];
};

export type ImportErrorCode = "empty" | "no-columns" | "too-many";

export class CollectionCsvError extends Error {
  constructor(readonly code: ImportErrorCode) {
    super(code);
    this.name = "CollectionCsvError";
  }
}

// ---------------------------------------------------------------- Export

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[;",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV « ; » avec BOM UTF-8 : s'ouvre tel quel dans Excel (FR) et LibreOffice. */
export function collectionToCsv(items: CollectionItemDTO[], catalog: CatalogDTO) {
  const printings = new Map(catalog.printings.map((printing) => [printing.id, printing]));
  const cards = new Map(catalog.cards.map((card) => [card.id, card]));
  const rows = items
    .map((item) => ({ item, printing: printings.get(item.printingId) }))
    .sort(
      (left, right) =>
        (left.printing?.setCode ?? "").localeCompare(right.printing?.setCode ?? "") ||
        (left.printing?.collectorNumber ?? "").localeCompare(right.printing?.collectorNumber ?? "", "en", {
          numeric: true,
        }) ||
        left.item.conditionCode.localeCompare(right.item.conditionCode),
    )
    .map(({ item, printing }) => {
      const card = printing ? cards.get(printing.cardId) : undefined;
      return [
        printing?.setCode,
        printing?.setName,
        printing?.collectorNumber,
        printing?.language,
        printing?.localizedName ?? card?.canonicalName,
        printing?.rarity,
        item.conditionCode,
        item.quantity,
        item.purchasePrice,
        item.purchasePrice ? item.purchaseCurrency : null,
        item.notes,
        item.printingId,
      ]
        .map(csvCell)
        .join(";");
    });
  return `﻿${[CSV_HEADERS.join(";"), ...rows].join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------- Import : colonnes

type Field =
  | "printingId"
  | "externalId"
  | "setCode"
  | "setName"
  | "number"
  | "language"
  | "name"
  | "localName"
  | "condition"
  | "quantity"
  | "purchasePrice"
  | "price"
  | "currency"
  | "notes"
  | "playset";

// En-têtes comparés sans accents, casse, espaces ni ponctuation (« Exp. Name » → « expname »).
const ALIASES: Record<Field, string[]> = {
  printingId: ["printingid", "idprinting"],
  externalId: ["externalid", "uuid"],
  setCode: ["setcode", "codeset", "codeextension", "exp"],
  setName: ["setname", "expname", "expansion", "expansionname", "set", "extension", "edition", "serie"],
  number: ["collectornumber", "number", "cardnumber", "collectorno", "no", "numero", "num", "nr", "nummer"],
  language: ["language", "lang", "langue", "idlanguage", "sprache", "idioma", "lingua"],
  name: ["name", "englishname", "enname", "cardname", "nom", "carte", "card", "productname", "product", "article"],
  localName: ["localname", "localizedname", "nomlocal", "nomfr"],
  condition: ["condition", "etat", "cond", "zustand", "estado", "condizione"],
  quantity: [
    "quantity",
    "qty",
    "quantite",
    "amount",
    "count",
    "groupcount",
    "copies",
    "exemplaires",
    "anzahl",
    "cantidad",
    "quantita",
  ],
  purchasePrice: ["purchaseprice", "prixdachat", "prixachat", "buyprice", "paid", "prixpaye"],
  price: ["price", "prix", "preis", "precio", "prezzo"],
  currency: ["purchasecurrency", "currency", "currencycode", "devise"],
  notes: ["notes", "note", "comments", "comment", "commentaire", "commentaires"],
  playset: ["isplayset", "playset"],
};

function headerKey(header: string) {
  return normalizeText(header).replace(/ /g, "");
}

function mapColumns(headers: string[]) {
  const keys = headers.map(headerKey);
  const columns: Partial<Record<Field, number>> = {};
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
    for (const alias of aliases) {
      const index = keys.indexOf(alias);
      if (index >= 0 && !Object.values(columns).includes(index)) {
        columns[field] = index;
        break;
      }
    }
  }
  return { columns, keys };
}

// ---------------------------------------------------------------- Import : valeurs

const CARDMARKET_LANGUAGES: Record<string, string> = { "1": "en", "2": "fr", "3": "de", "4": "es", "5": "it" };

const LANGUAGE_WORDS: Record<string, string> = {
  en: "en",
  eng: "en",
  english: "en",
  anglais: "en",
  englisch: "en",
  ingles: "en",
  inglese: "en",
  fr: "fr",
  fra: "fr",
  french: "fr",
  francais: "fr",
  franzosisch: "fr",
  frances: "fr",
  francese: "fr",
  de: "de",
  german: "de",
  allemand: "de",
  deutsch: "de",
  es: "es",
  spanish: "es",
  espagnol: "es",
  it: "it",
  italian: "it",
  italien: "it",
};

function parseLanguage(value: string) {
  const key = headerKey(value);
  if (!key) return null;
  return CARDMARKET_LANGUAGES[key] ?? LANGUAGE_WORDS[key] ?? null;
}

// Échelle Cardmarket (MT > NM > EX > GD > LP > PL > PO) ramenée aux 5 états de l'application.
const CARDMARKET_CONDITIONS: Record<string, string> = {
  mt: "NM",
  nm: "NM",
  ex: "LP",
  gd: "MP",
  lp: "MP",
  pl: "HP",
  po: "DMG",
};

const CONDITION_WORDS: Record<string, string> = {
  mint: "NM",
  nearmint: "NM",
  neuf: "NM",
  quasineuf: "NM",
  lightlyplayed: "LP",
  lightplayed: "LP",
  excellent: "LP",
  moderatelyplayed: "MP",
  good: "MP",
  bonetat: "MP",
  bon: "MP",
  heavilyplayed: "HP",
  played: "HP",
  joue: "HP",
  damaged: "DMG",
  poor: "DMG",
  abime: "DMG",
  endommage: "DMG",
};

const APP_CONDITIONS = new Set<string>(CONDITIONS.map((condition) => condition.code));

function parseCondition(value: string, format: ImportFormat, fallback: string) {
  const key = headerKey(value);
  if (!key) return fallback;
  if (format === "cardmarket" && CARDMARKET_CONDITIONS[key]) return CARDMARKET_CONDITIONS[key];
  const upper = key.toUpperCase();
  if (APP_CONDITIONS.has(upper)) return upper;
  return CONDITION_WORDS[key] ?? CARDMARKET_CONDITIONS[key] ?? fallback;
}

function parseQuantity(value: string) {
  const text = value.trim();
  if (!text) return 1;
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function isTruthy(value: string) {
  return ["1", "true", "yes", "oui", "x"].includes(value.trim().toLowerCase());
}

function parsePrice(value: string) {
  const text = value.trim().replace(/\s|€|\$|£/g, "").replace(",", ".");
  if (!text) return undefined;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return undefined;
  return amount.toFixed(2);
}

function parseCurrency(value: string) {
  const code = value.trim().toUpperCase();
  return (CURRENCIES as readonly string[]).includes(code) ? code : undefined;
}

// ---------------------------------------------------------------- Import : correspondance des cartes

type Indexed = {
  printing: PrintingDTO;
  setBase: string;
  setRank: number;
  nameKeys: Set<string>;
  baseNameKey: string;
};

function setBaseCode(code: string) {
  return code.toLowerCase().replace(/-fr$/, "");
}

function setNameKey(name: string) {
  return normalizeText(name).replace(/ fr$/, "");
}

function buildIndex(catalog: CatalogDTO) {
  const cards = new Map(catalog.cards.map((card) => [card.id, card]));
  const setRank = new Map(catalog.sets.map((set) => [set.code, set.sortOrder]));
  const indexed: Indexed[] = catalog.printings.map((printing) => {
    const card = cards.get(printing.cardId);
    const names = [printing.localizedName, card?.canonicalName, card?.name && card.subname ? `${card.name} ${card.subname}` : card?.name];
    return {
      printing,
      setBase: setBaseCode(printing.setCode),
      setRank: (isSealedSetCode(printing.setCode) ? 10_000 : 0) + (setRank.get(printing.setCode) ?? 0),
      nameKeys: new Set(names.filter((name): name is string => Boolean(name)).map(productNameKey)),
      baseNameKey: card ? productNameKey(card.name) : "",
    };
  });
  const sets = catalog.sets.map((set) => ({ base: setBaseCode(set.code), nameKey: setNameKey(set.name) }));
  return {
    indexed,
    sets,
    byId: new Map(catalog.printings.map((printing) => [printing.id, printing])),
    byExternalId: new Map(catalog.printings.map((printing) => [printing.externalId, printing])),
  };
}

type Index = ReturnType<typeof buildIndex>;

/** Codes de base des sets désignés par les indices (code ou nom d'extension), ou null. */
function matchSets(index: Index, hints: string[]) {
  const exact = new Set<string>();
  const loose = new Set<string>();
  for (const hint of hints) {
    const normalized = normalizeText(hint);
    if (!normalized) continue;
    const wanted = (EXPANSION_ALIASES[normalized] ?? normalized).replace(/ fr$/, "");
    const compact = setBaseCode(hint.trim()).replace(/[^a-z0-9-]/g, "");
    for (const set of index.sets) {
      if (set.base === compact || set.nameKey === wanted || set.nameKey.replace(/ /g, "") === compact) {
        exact.add(set.base);
      } else if (wanted.length >= 4 && set.nameKey.includes(wanted)) loose.add(set.base);
    }
  }
  if (exact.size) return exact;
  return loose.size ? loose : null;
}

function pickBest(candidates: Indexed[]) {
  return candidates.toSorted(
    (left, right) =>
      left.setRank - right.setRank ||
      left.printing.collectorNumber.localeCompare(right.printing.collectorNumber, "en", { numeric: true }),
  )[0];
}

function findPrinting(
  index: Index,
  query: { language: string | null; sets: Set<string> | null; number: string; names: string[] },
): { printing: PrintingDTO; guessed: boolean } | null {
  const nameKeys = query.names.map(productNameKey).filter(Boolean);
  const filter = (useSets: boolean, nameMode: "full" | "base") =>
    index.indexed.filter(
      (entry) =>
        (!query.language || entry.printing.language === query.language) &&
        (!useSets || !query.sets || query.sets.has(entry.setBase)) &&
        (!query.number || numberMatches(entry.printing.collectorNumber, query.number)) &&
        (nameKeys.length === 0 ||
          nameKeys.some((key) => (nameMode === "full" ? entry.nameKeys.has(key) : entry.baseNameKey === key))),
    );

  const attempts: [boolean, "full" | "base"][] = [
    [true, "full"],
    [true, "base"],
    [false, "full"],
    [false, "base"],
  ];
  for (const [index_, [useSets, nameMode]] of attempts.entries()) {
    if (nameMode === "base" && nameKeys.length === 0) continue;
    const candidates = filter(useSets, nameMode);
    if (candidates.length === 0) continue;
    if (candidates.length === 1) return { printing: candidates[0].printing, guessed: index_ > 0 };
    // Sans langue précisée, l'anglais est le tirage le plus courant.
    const english = query.language ? candidates : candidates.filter((entry) => entry.printing.language === "en");
    const pool = english.length ? english : candidates;
    return { printing: pickBest(pool).printing, guessed: index_ > 0 || pool.length > 1 };
  }
  return null;
}

// ---------------------------------------------------------------- Import : lecture du fichier

export function parseCollectionCsv(
  text: string,
  catalog: CatalogDTO,
  options: { defaultCondition: string; defaultCurrency: string },
): ImportPreview {
  const rows = parseCsv(text.replace(/^﻿/, "").trim());
  if (rows.length < 2) throw new CollectionCsvError("empty");
  const { columns, keys } = mapColumns(rows[0]);
  const identifies = ["printingId", "externalId", "name", "localName", "number"].some(
    (field) => columns[field as Field] != null,
  );
  if (!identifies) throw new CollectionCsvError("no-columns");

  const format: ImportFormat =
    columns.printingId != null
      ? "app"
      : keys.some((key) => ["idproduct", "idarticle", "isplayset", "isfoil"].includes(key))
        ? "cardmarket"
        : "generic";
  const defaultCondition = APP_CONDITIONS.has(options.defaultCondition) ? options.defaultCondition : "NM";
  const index = buildIndex(catalog);
  const setCache = new Map<string, Set<string> | null>();

  const merged = new Map<string, ImportLine>();
  const guessed: ImportIssue[] = [];
  const rejected: ImportIssue[] = [];
  const read = (row: string[], field: Field) => {
    const at = columns[field];
    return at == null ? "" : (row[at] ?? "").trim();
  };

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const names = [read(row, "name"), read(row, "localName")].filter(Boolean);
    const number = read(row, "number");
    const label = [names[0], number && `#${number}`].filter(Boolean).join(" ") || `#${rowNumber}`;

    const quantity = parseQuantity(read(row, "quantity"));
    if (quantity == null) {
      rejected.push({ row: rowNumber, label, reason: "bad-quantity" });
      return;
    }
    const copies = quantity * (isTruthy(read(row, "playset")) ? 4 : 1);
    if (copies === 0) return;

    let match: { printing: PrintingDTO; guessed: boolean } | null = null;
    const direct = index.byId.get(read(row, "printingId")) ?? index.byExternalId.get(read(row, "externalId"));
    if (direct) match = { printing: direct, guessed: false };
    else if (!names.length && !number) {
      rejected.push({ row: rowNumber, label, reason: "no-identity" });
      return;
    } else {
      const hints = [read(row, "setCode"), read(row, "setName")].filter(Boolean);
      const cacheKey = hints.join("|");
      if (!setCache.has(cacheKey)) setCache.set(cacheKey, hints.length ? matchSets(index, hints) : null);
      match = findPrinting(index, {
        language: parseLanguage(read(row, "language")),
        sets: setCache.get(cacheKey) ?? null,
        number,
        names,
      });
    }
    if (!match) {
      rejected.push({ row: rowNumber, label, reason: "unknown-card" });
      return;
    }
    if (match.guessed) guessed.push({ row: rowNumber, label });

    const conditionCode = parseCondition(read(row, "condition"), format, defaultCondition);
    // Le « Price » Cardmarket est un prix de vente, pas un prix d'achat : ignoré.
    const purchasePrice = parsePrice(read(row, "purchasePrice")) ?? (format === "cardmarket" ? undefined : parsePrice(read(row, "price")));
    const notes = read(row, "notes").slice(0, 2000) || undefined;
    const key = `${match.printing.id}|${conditionCode}`;
    const line = merged.get(key) ?? { printingId: match.printing.id, conditionCode, quantity: 0 };
    line.quantity += copies;
    if (notes) line.notes = notes;
    if (purchasePrice) {
      line.purchasePrice = purchasePrice;
      line.purchaseCurrency = parseCurrency(read(row, "currency")) ?? options.defaultCurrency;
    }
    merged.set(key, line);
  });

  const lines = [...merged.values()];
  if (lines.length > MAX_IMPORT_LINES) throw new CollectionCsvError("too-many");
  return {
    format,
    rows: rows.length - 1,
    lines,
    copies: lines.reduce((sum, line) => sum + line.quantity, 0),
    guessed,
    rejected,
  };
}
