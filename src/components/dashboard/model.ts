// Données du tableau de bord : blocs, extensions, progression et valeurs, calculées depuis le catalogue.

import type { Href } from "@/i18n/navigation";
import {
  aggregateCollection,
  buildInvestmentLines,
  computeProgress,
  investmentBySet,
  priceMovement,
  spentAmount,
  type PriceMovement,
  type SetInvestment,
} from "@/lib/logic";
import { ALL_SETS_ID, BLOCKS, isSealedSetCode, MIN_EXTENSION_CARDS, partitionCatalogSets } from "@/lib/reference-data";
import { rarityFill } from "@/lib/rarity-color";
import type { CatalogDTO, CollectionItemDTO, Ownership, PrintingDTO, Progress } from "@/lib/types";

export const LANGUAGES = ["en", "fr"] as const;
/** Code du set anglais → place de l'extension dans les blocs (index du bloc, rang dans le bloc). */
const BLOCK_OF_SET = new Map(
  BLOCKS.flatMap((block, blockIndex) => block.sets.map((set, order) => [set, { block: blockIndex, order }])),
);
/** Code d'un produit lié (promos, box toppers, decks…) → index de son bloc. */
const BLOCK_OF_RELATED_SET = new Map(
  BLOCKS.flatMap((block, blockIndex) => (block.related ?? []).map((set) => [set, blockIndex])),
);

export type Language = (typeof LANGUAGES)[number];
export type CatalogMode = "cards" | "sealed";
export type SortKey = "catalog" | "progress" | "value";

export type ValueSummary = {
  copies: number;
  pricedCopies: number;
  marketTotal: number;
  marketDelta: PriceMovement;
  marketDeltaAmount: number | null;
  profitEur: number | null;
};

type ValueParts = Pick<ValueSummary, "copies" | "pricedCopies" | "marketTotal" | "marketDeltaAmount" | "profitEur">;

/** Ce que le détail affiche : un bloc entier ou une de ses extensions. */
export type Scope = {
  key: string;
  name: string;
  browseSet: string;
  language: Language;
  printings: PrintingDTO[];
  ownership: Map<string, Ownership>;
  progress: Progress;
  value: ValueSummary | null;
};

/** Une extension (ou une catégorie scellée). */
export type Extension = Scope & {
  /** Nom sans celui du bloc (« Beta » pour « Welcome to Night City — Beta »). */
  shortName: string;
  /** Codes de set dont la valeur est comptée dans cette extension. */
  codes: string[];
  /** Index dans BLOCKS (nul = non classée) et rang de sortie dans le bloc. */
  block: number | null;
  order: number | null;
  sortOrder: number;
  /** Produit lié du bloc (pas une extension) : listé, mais hors de la progression du bloc. */
  related: boolean;
};

export type Block = Scope & { extensions: Extension[] };

/** Ligne du tableau des valeurs : une extension par langue, ou le reste regroupé (name nul). */
export type ValueRow = {
  key: string;
  name: string | null;
  language: Language | null;
  /** Filtre d'extension de la page Investissement (nul pour la ligne « autres »). */
  set: string | null;
  value: ValueSummary;
};

/** Extension sélectionnée dans un bloc. */
export type BlockPick = { block: string; extension: string };

export function languageFor(language: string): Language {
  return language === "fr" ? "fr" : "en";
}

function summarizeRows(rows: (ValueParts | null | undefined)[]): ValueSummary | null {
  const present = rows.filter((row): row is ValueParts => row != null);
  if (present.length === 0) return null;
  let copies = 0;
  let pricedCopies = 0;
  let marketTotal = 0;
  let deltaAmount: number | null = null;
  let profit: number | null = null;
  for (const row of present) {
    copies += row.copies;
    pricedCopies += row.pricedCopies;
    marketTotal += row.marketTotal;
    if (row.marketDeltaAmount != null) deltaAmount = (deltaAmount ?? 0) + row.marketDeltaAmount;
    if (row.profitEur != null) profit = (profit ?? 0) + row.profitEur;
  }
  return {
    copies,
    pricedCopies,
    marketTotal,
    marketDelta: deltaAmount == null ? "none" : priceMovement(marketTotal, marketTotal - deltaAmount),
    marketDeltaAmount: deltaAmount,
    profitEur: profit,
  };
}

export function sumProgress(list: Progress[]): Progress {
  const total = list.reduce(
    (acc, entry) => ({
      uniqueOwned: acc.uniqueOwned + entry.uniqueOwned,
      total: acc.total + entry.total,
      missing: acc.missing + entry.missing,
      duplicates: acc.duplicates + entry.duplicates,
      extraCopies: acc.extraCopies + entry.extraCopies,
      totalCopies: acc.totalCopies + entry.totalCopies,
    }),
    {
      uniqueOwned: 0,
      total: 0,
      missing: 0,
      duplicates: 0,
      extraCopies: 0,
      totalCopies: 0,
    },
  );
  return {
    ...total,
    percent: total.total === 0 ? 0 : (total.uniqueOwned / total.total) * 100,
  };
}

function buildCardExtensions(
  catalog: CatalogDTO,
  agg: Map<string, Ownership>,
  language: Language,
  rows: SetInvestment[],
): Extension[] {
  const rowByCode = new Map(rows.map((row) => [row.setCode, row]));
  const { cardSets } = partitionCatalogSets(catalog.sets);
  const result: Extension[] = [];

  // Une extension par set anglais, remplacée par son jumeau « -fr » en français.
  // Hors BLOCKS, les petits sets (promos, decks, tournois) ne sont pas des extensions.
  // Les produits liés d'un bloc n'apparaissent que si l'on en possède au moins une carte.
  const groups = new Map<string, typeof cardSets>();
  for (const set of cardSets) {
    const base = set.code.replace(/-fr$/u, "");
    groups.set(base, [...(groups.get(base) ?? []), set]);
  }
  for (const [base, group] of groups) {
    const place = BLOCK_OF_SET.get(base) ?? null;
    const relatedBlock = place ? null : (BLOCK_OF_RELATED_SET.get(base) ?? null);
    const candidates = language === "fr" ? [`${base}-fr`, base] : [base];
    for (const code of candidates) {
      const set = group.find((entry) => entry.code === code);
      if (!set) continue;
      const printings = catalog.printings.filter(
        (printing) => printing.setCode === code && printing.language === language,
      );
      if (printings.length === 0) continue;
      if (relatedBlock != null) {
        if (!printings.some((printing) => (agg.get(printing.id)?.qty ?? 0) > 0)) continue;
      } else if (!place && printings.length < MIN_EXTENSION_CARDS) continue;
      const name = group.find((entry) => entry.code === base)?.name ?? set.name;
      // Dans son bloc, « Welcome to Night City — Beta » se lit simplement « Beta ».
      const prefix = place ? `${BLOCKS[place.block].name} — ` : null;
      result.push({
        key: base,
        name,
        shortName: prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name,
        browseSet: code,
        codes: [code],
        block: place?.block ?? relatedBlock,
        order: place?.order ?? null,
        language,
        sortOrder: set.sortOrder,
        related: relatedBlock != null,
        printings,
        ownership: agg,
        progress: computeProgress(printings, agg),
        value: summarizeRows([rowByCode.get(code)]),
      });
      break;
    }
  }
  return result.sort(
    (a, b) =>
      (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, "fr"),
  );
}

function buildBlocks(extensions: Extension[], agg: Map<string, Ownership>, unsortedLabel: string): Block[] {
  const byBlock = new Map<number | null, Extension[]>();
  for (const extension of extensions) {
    byBlock.set(extension.block, [...(byBlock.get(extension.block) ?? []), extension]);
  }
  return [...byBlock.entries()]
    .sort(([a], [b]) => (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY))
    .map(([index, list]) => {
      // La progression du bloc ne compte que ses extensions, pas les produits liés.
      const core = list.some((extension) => !extension.related)
        ? list.filter((extension) => !extension.related)
        : list;
      return {
        key: `block-${index ?? "unsorted"}`,
        name: index == null ? unsortedLabel : BLOCKS[index].name,
        extensions: list,
        browseSet: blockBrowseSet(core),
        language: list[0].language,
        printings: core.flatMap((extension) => extension.printings),
        ownership: agg,
        progress: sumProgress(core.map((extension) => extension.progress)),
        value: summarizeRows(list.map((extension) => extension.value)),
      };
    });
}

/** Lien Cartes d'un bloc : son unique set, sinon toutes les extensions. */
function blockBrowseSet(list: Extension[]) {
  return list.length === 1 ? list[0].browseSet : ALL_SETS_ID;
}

export function sortScopes<T extends Scope>(list: T[], sort: SortKey) {
  if (sort === "catalog") return list;
  return [...list].sort((a, b) =>
    sort === "progress"
      ? b.progress.percent - a.progress.percent
      : (b.value?.marketTotal ?? 0) - (a.value?.marketTotal ?? 0),
  );
}

/** Prix marché d'un exemplaire de chaque impression (nul si aucune n'a de prix). */
export function fullSetPrice(printings: PrintingDTO[]) {
  let total = 0;
  let priced = 0;
  for (const printing of printings) {
    const price = printing.marketPrice == null ? Number.NaN : Number(printing.marketPrice);
    if (!Number.isFinite(price)) continue;
    priced += 1;
    total += price;
  }
  return priced === 0 ? null : { total, priced, count: printings.length };
}

export function cardsHref(query: Record<string, string>): Href {
  return { pathname: "/cards", query };
}

/** L'extension qui correspond au set déjà choisi ailleurs dans l'app. */
export function matchesSet(extension: Extension, set: string) {
  return extension.key === set || extension.browseSet === set || extension.codes.includes(set);
}

export function investmentHref(set: string, language: Language | null): Href {
  return { pathname: "/investissement", query: language ? { set, language } : { set } };
}

export function rarityColor(rarity: string) {
  return rarityFill(rarity) ?? "var(--line)";
}

/** Vue complète du tableau de bord pour une langue : blocs, catégories scellées et lignes de valeur. */
export function buildDashboardView(catalog: CatalogDTO, items: CollectionItemDTO[], language: Language, unsortedLabel: string) {
  const agg = aggregateCollection(items);
  const cardsById = new Map(catalog.cards.map((card) => [card.id, card]));
  const lines = buildInvestmentLines(items, catalog.printings, cardsById);
  const cardRows = investmentBySet(
    lines.filter((line) => !isSealedSetCode(line.setCode)),
    catalog.sets,
  ).filter((row) => !isSealedSetCode(row.setCode));
  // Un code scellé couvre toutes les langues : on agrège langue par langue.
  const sealedLines = lines.filter((line) => isSealedSetCode(line.setCode));
  const sealedRowsFor = (entry: Language) =>
    investmentBySet(
      sealedLines.filter((line) => line.language === entry),
      catalog.sets,
    ).filter((row) => isSealedSetCode(row.setCode));
  const sealedRows = sealedRowsFor(language);
  const sealedRowByCode = new Map(sealedRows.map((row) => [row.setCode, row]));

  const cardExtensions = buildCardExtensions(catalog, agg, language, cardRows);
  const blocks = buildBlocks(cardExtensions, agg, unsortedLabel);
  const sealedExtensions: Extension[] = partitionCatalogSets(catalog.sets)
    .sealedSets.map((set) => {
      const printings = catalog.printings.filter(
        (printing) => printing.setCode === set.code && printing.language === language,
      );
      return {
        key: set.code,
        name: set.name,
        browseSet: set.code,
        codes: [set.code],
        block: null,
        order: null,
        shortName: set.name,
        language,
        sortOrder: set.sortOrder,
        related: false,
        printings,
        ownership: agg,
        progress: computeProgress(printings, agg),
        value: summarizeRows([sealedRowByCode.get(set.code)]),
      };
    })
    .filter((entry) => entry.printings.length > 0);

  // Valeurs : chaque extension dans chaque langue, puis tous les autres sets regroupés.
  const usedCodes = new Set<string>();
  const cardValueRows: ValueRow[] = [];
  for (const entry of LANGUAGES) {
    const list = entry === language ? cardExtensions : buildCardExtensions(catalog, agg, entry, cardRows);
    for (const extension of list) {
      extension.codes.forEach((code) => usedCodes.add(code));
      if (extension.value) {
        cardValueRows.push({
          key: `${extension.key}|${entry}`,
          name: extension.name,
          language: entry,
          set: extension.browseSet,
          value: extension.value,
        });
      }
    }
  }
  const otherValue = summarizeRows(cardRows.filter((row) => !usedCodes.has(row.setCode)));
  if (otherValue)
    cardValueRows.push({
      key: "other",
      name: null,
      language: null,
      set: null,
      value: otherValue,
    });
  const sealedValueRows: ValueRow[] = LANGUAGES.flatMap((entry) =>
    (entry === language ? sealedRows : sealedRowsFor(entry)).flatMap((row) => {
      const value = summarizeRows([row]);
      return value ? [{ key: `${row.setCode}|${entry}`, name: row.setName, language: entry, set: row.setCode, value }] : [];
    }),
  );

  return {
    agg,
    cardRowByCode: new Map(cardRows.map((row) => [row.setCode, row])),
    blocks,
    sealedExtensions,
    cardValueRows,
    sealedValueRows,
    cardValue: summarizeRows(cardRows),
    sealedValue: summarizeRows(sealedRows),
    spent: spentAmount(items),
    hasPrices: catalog.hasPrices,
  };
}
