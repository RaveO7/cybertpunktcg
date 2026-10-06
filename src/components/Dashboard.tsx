"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection } from "@/components/CollectionProvider";
import { TrendBadge, formatSignedMoney } from "@/components/TrendBadge";
import {
  aggregateCollection,
  buildInvestmentLines,
  computeProgress,
  formatInt,
  formatMoney,
  formatPercent,
  investmentBySet,
  priceMovement,
  progressByRarity,
  spentAmount,
  type PriceMovement,
  type SetInvestment,
} from "@/lib/logic";
import {
  ALL_SETS_ID,
  BETA_SET_CODE,
  BLOCKS,
  isSealedSetCode,
  MIN_EXTENSION_CARDS,
  partitionCatalogSets,
} from "@/lib/reference-data";
import { useI18n } from "@/components/LocaleProvider";
import { intlLocale } from "@/lib/i18n/messages";
import { rarityFill } from "@/lib/rarity-color";
import type { CatalogDTO, Ownership, PrintingDTO, Progress } from "@/lib/types";

const LANGUAGES = ["en", "fr"] as const;
/** Code du set anglais → place de l'extension dans les blocs (index du bloc, rang dans le bloc). */
const BLOCK_OF_SET = new Map(
  BLOCKS.flatMap((block, blockIndex) => block.sets.map((set, order) => [set, { block: blockIndex, order }])),
);

type Language = (typeof LANGUAGES)[number];
type CatalogMode = "cards" | "sealed";
type SortKey = "catalog" | "progress" | "value";

type ValueSummary = {
  copies: number;
  pricedCopies: number;
  marketTotal: number;
  marketDelta: PriceMovement;
  marketDeltaAmount: number | null;
  profitEur: number | null;
};

type ValueParts = Pick<ValueSummary, "copies" | "pricedCopies" | "marketTotal" | "marketDeltaAmount" | "profitEur">;

/** Ce que le détail affiche : un bloc entier ou une de ses extensions. */
type Scope = {
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
type Extension = Scope & {
  /** Nom sans celui du bloc (« Beta » pour « Welcome to Night City — Beta »). */
  shortName: string;
  /** Codes de set dont la valeur est comptée dans cette extension. */
  codes: string[];
  /** Index dans BLOCKS (nul = non classée) et rang de sortie dans le bloc. */
  block: number | null;
  order: number | null;
  sortOrder: number;
};

type Block = Scope & { extensions: Extension[] };

/** Ligne du tableau des valeurs : une extension par langue, ou le reste regroupé (name nul). */
type ValueRow = {
  key: string;
  name: string | null;
  language: Language | null;
  value: ValueSummary;
};

/** Extension sélectionnée dans un bloc. */
type BlockPick = { block: string; extension: string };

function languageFor(language: string): Language {
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

function sumProgress(list: Progress[]): Progress {
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
  const groups = new Map<string, typeof cardSets>();
  for (const set of cardSets) {
    const base = set.code.replace(/-fr$/u, "");
    groups.set(base, [...(groups.get(base) ?? []), set]);
  }
  for (const [base, group] of groups) {
    const place = BLOCK_OF_SET.get(base) ?? null;
    const candidates = language === "fr" ? [`${base}-fr`, base] : [base];
    for (const code of candidates) {
      const set = group.find((entry) => entry.code === code);
      if (!set) continue;
      const printings = catalog.printings.filter(
        (printing) => printing.setCode === code && printing.language === language,
      );
      if (printings.length === 0 || (!place && printings.length < MIN_EXTENSION_CARDS)) continue;
      const name = group.find((entry) => entry.code === base)?.name ?? set.name;
      // Dans son bloc, « Welcome to Night City — Beta » se lit simplement « Beta ».
      const prefix = place ? `${BLOCKS[place.block].name} — ` : null;
      result.push({
        key: base,
        name,
        shortName: prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name,
        browseSet: code,
        codes: [code],
        block: place?.block ?? null,
        order: place?.order ?? null,
        language,
        sortOrder: set.sortOrder,
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
      return {
        key: `block-${index ?? "unsorted"}`,
        name: index == null ? unsortedLabel : BLOCKS[index].name,
        extensions: list,
        browseSet: blockBrowseSet(list),
        language: list[0].language,
        printings: list.flatMap((extension) => extension.printings),
        ownership: agg,
        progress: sumProgress(list.map((extension) => extension.progress)),
        value: summarizeRows(list.map((extension) => extension.value)),
      };
    });
}

/** Lien Cartes d'un bloc : son unique set, sinon toutes les extensions. */
function blockBrowseSet(list: Extension[]) {
  return list.length === 1 ? list[0].browseSet : ALL_SETS_ID;
}

function sortScopes<T extends Scope>(list: T[], sort: SortKey) {
  if (sort === "catalog") return list;
  return [...list].sort((a, b) =>
    sort === "progress"
      ? b.progress.percent - a.progress.percent
      : (b.value?.marketTotal ?? 0) - (a.value?.marketTotal ?? 0),
  );
}

function cardsHref(params: Record<string, string>) {
  return `/cards?${new URLSearchParams(params)}`;
}

/** L'extension qui correspond au set déjà choisi ailleurs dans l'app. */
function matchesSet(extension: Extension, set: string) {
  return extension.key === set || extension.browseSet === set || extension.codes.includes(set);
}

export function Dashboard() {
  const { ready, error, catalog, items } = useCollection();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { selection, setSelection } = useBrowseSelection();
  const numberLocale = intlLocale(locale);
  const [mode, setMode] = useState<CatalogMode>(() => (isSealedSetCode(selection.set) ? "sealed" : "cards"));
  const [language, setLanguage] = useState<Language>(() => languageFor(selection.language));
  const [sort, setSort] = useState<SortKey>("catalog");
  // Au chargement, rien n'est sélectionné : l'en-tête cumule tous les blocs.
  const [selectedKey, setSelectedKey] = useState<Record<CatalogMode, string>>({
    cards: "",
    sealed: "",
  });
  const [pick, setPick] = useState<BlockPick | null>(null);

  const view = useMemo(() => {
    if (!catalog) return null;
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
    const blocks = buildBlocks(cardExtensions, agg, t.dashboard.unsortedBlock);
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
        value: otherValue,
      });
    const sealedValueRows: ValueRow[] = LANGUAGES.flatMap((entry) =>
      (entry === language ? sealedRows : sealedRowsFor(entry)).flatMap((row) => {
        const value = summarizeRows([row]);
        return value ? [{ key: `${row.setCode}|${entry}`, name: row.setName, language: entry, value }] : [];
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
  }, [catalog, items, language, t]);

  const isSealed = mode === "sealed";
  const gridItems: (Block | Extension)[] = view ? (isSealed ? view.sealedExtensions : view.blocks) : [];
  const wanted = selectedKey[mode];
  const current: Block | Extension | null =
    (!wanted
      ? null
      : isSealed
        ? view?.sealedExtensions.find((entry) => entry.key === wanted)
        : view?.blocks.find(
            (entry) =>
              entry.key === wanted ||
              entry.browseSet === wanted ||
              entry.extensions.some((extension) => matchesSet(extension, wanted)),
          )) ??
    // Un seul bloc (grille masquée) : il est forcément sélectionné.
    (!isSealed && gridItems.length === 1 ? gridItems[0] : null);
  const block = current && "extensions" in current ? current : null;

  // Dans un bloc : 1er clic = progression à côté, 2e clic sur la même ligne = page Cartes.
  const pickedExtension =
    block && pick?.block === block.key
      ? (block.extensions.find((extension) => extension.key === pick.extension) ?? null)
      : null;
  const scope: Scope | null = pickedExtension ?? current;

  const scopeSet = scope?.browseSet;
  const scopeLanguage = scope?.language;
  useEffect(() => {
    if (!scopeSet || !scopeLanguage) return;
    setSelection({ set: scopeSet, language: scopeLanguage });
  }, [scopeSet, scopeLanguage, setSelection]);

  if (error) return <p className="mx-auto max-w-[1600px] p-6 text-danger">{error}</p>;
  if (!ready || !view || !catalog) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-10">
        <div className="hud-panel flex items-center justify-center gap-3 px-6 py-12 text-muted">
          <span className="inline-block size-4 animate-pulse rounded-full bg-cyan/80" aria-hidden />
          {t.dashboard.loading}
        </div>
      </div>
    );
  }
  if (catalog.printings.length === 0) return <EmptyCatalog />;

  const globalValue = isSealed ? view.sealedValue : view.cardValue;
  // L'en-tête suit la sélection : bloc entier, extension ou impression (ou catégorie scellée).
  const heroProgress = scope?.progress ?? sumProgress(gridItems.map((entry) => entry.progress));
  const heroValue = scope ? scope.value : globalValue;
  const heroSet = scope?.browseSet ?? (isSealed ? "" : ALL_SETS_ID);
  const heroLanguage = scope?.language ?? language;
  const heroTitle =
    pickedExtension?.shortName ?? scope?.name ?? (isSealed ? t.dashboard.sealed : t.dashboard.allSetsTitle);
  const heroIntro = isSealed
    ? scope
      ? t.dashboard.sealedProductsHint(formatInt(scope.printings.length))
      : t.dashboard.sealedIntro
    : pickedExtension
      ? t.dashboard.extensionIntro(formatInt(pickedExtension.progress.total))
      : [
          t.dashboard.globalIntro(
            formatInt(block?.extensions.length ?? 0),
            t.dashboard.extensionNoun(block?.extensions.length ?? 0),
          ),
          block?.extensions.some((extension) => extension.codes.includes(BETA_SET_CODE)) ? t.dashboard.splitNote : null,
        ]
          .filter(Boolean)
          .join(" ");
  // Tri par valeur, la ligne « autres » toujours en dernier.
  const valueRows = [...(isSealed ? view.sealedValueRows : view.cardValueRows)].sort(
    (a, b) => Number(a.name == null) - Number(b.name == null) || b.value.marketTotal - a.value.marketTotal,
  );
  const valueTotal = valueRows.reduce((sum, row) => sum + row.value.marketTotal, 0);
  const spentLine =
    view.spent.pricedLines > 0
      ? view.spent.totals
          .map(([currency, amount]) =>
            new Intl.NumberFormat(numberLocale, {
              style: "currency",
              currency,
            }).format(amount),
          )
          .join(", ")
      : null;

  // Re-cliquer la carte sélectionnée revient à la vue de tous les blocs.
  const selectItem = (entry: Block | Extension) => {
    setSelectedKey((prev) => ({
      ...prev,
      [mode]: prev[mode] === entry.key ? "" : entry.key,
    }));
    setPick(null);
  };
  const pickRow = (extension: Extension) => {
    if (!block) return;
    if (pickedExtension?.key === extension.key) {
      router.push(cardsHref({ set: extension.browseSet, language: extension.language }));
      return;
    }
    setPick({ block: block.key, extension: extension.key });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-6 sm:py-8">
      {/* 1. Vue globale */}
      <section className="hud-panel relative overflow-hidden">
        {/* Hauteur ≈ 90 % de l'arc du coin (rayon 11px), puis le jaune longe le haut. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 h-[9px] rounded-tl-[11px] border-l-2 border-t-2 border-yellow transition-[width] duration-700 ${
            heroProgress.percent >= 100 ? "rounded-tr-[11px] border-r-2" : ""
          }`}
          style={{
            width: `${Math.min(100, Math.max(0, heroProgress.percent))}%`,
          }}
        />
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-5 sm:gap-6">
            <ProgressRing percent={heroProgress.percent} label={formatPercent(heroProgress.percent)} />
            <div className="min-w-0">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
                {t.dashboard.eyebrow}
                {current && scope !== current ? ` · ${current.name}` : null}
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-4xl">
                {heroTitle}
              </h1>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{heroIntro}</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:max-w-sm">
            <div className="flex flex-wrap gap-3">
              <SegmentGroup ariaLabel={t.dashboard.modeCards} grow>
                <SegmentButton active={!isSealed} onClick={() => setMode("cards")}>
                  {t.dashboard.modeCards}
                </SegmentButton>
                <SegmentButton active={isSealed} onClick={() => setMode("sealed")}>
                  {t.dashboard.modeSealed}
                </SegmentButton>
              </SegmentGroup>
              <SegmentGroup ariaLabel={t.investment.language}>
                {LANGUAGES.map((entry) => (
                  <SegmentButton
                    key={entry}
                    active={language === entry}
                    onClick={() => {
                      setLanguage(entry);
                      setPick(null);
                    }}
                  >
                    {entry.toUpperCase()}
                  </SegmentButton>
                ))}
              </SegmentGroup>
            </div>
            <form action="/cards" className="flex">
              <input type="hidden" name="set" value={heroSet} />
              <input type="hidden" name="language" value={heroLanguage} />
              <label className="flex h-11 w-full items-center gap-2.5 border border-line bg-panel-2 px-3.5 text-muted focus-within:border-cyan">
                <SearchIcon />
                <span className="sr-only">{t.common.search}</span>
                <input
                  name="q"
                  type="search"
                  placeholder={isSealed ? t.dashboard.sealedSearchPlaceholder : t.dashboard.searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/80"
                />
              </label>
            </form>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line/60 xl:grid-cols-4">
          <GlobalStat label={isSealed ? t.dashboard.uniqueSealed : t.dashboard.uniqueCards}>
            <span className="font-mono text-2xl text-yellow sm:text-3xl">{formatInt(heroProgress.uniqueOwned)}</span>
            <span className="font-mono text-sm text-muted">/ {formatInt(heroProgress.total)}</span>
          </GlobalStat>
          <GlobalStat
            label={t.dashboard.missing}
            href={cardsHref({
              set: heroSet,
              language: heroLanguage,
              collection: "missing",
            })}
            linkLabel={t.dashboard.see}
            tone="danger"
          >
            <span className="font-mono text-2xl text-danger sm:text-3xl">{formatInt(heroProgress.missing)}</span>
          </GlobalStat>
          <GlobalStat
            label={t.dashboard.duplicates}
            href={cardsHref({
              set: heroSet,
              language: heroLanguage,
              collection: "duplicates",
            })}
            linkLabel={t.dashboard.see}
          >
            <span className="font-mono text-2xl sm:text-3xl">{formatInt(heroProgress.duplicates)}</span>
          </GlobalStat>
          <GlobalStat label={isSealed ? t.dashboard.sealedTrendValue : t.dashboard.trendValue} last>
            {view.hasPrices && heroValue && heroValue.pricedCopies > 0 ? (
              <>
                <span className="font-mono text-xl text-yellow sm:text-3xl">{formatMoney(heroValue.marketTotal)}</span>
                <TrendBadge delta={heroValue.marketDelta} amount={heroValue.marketDeltaAmount} />
              </>
            ) : (
              <span className="text-sm text-muted">{t.dashboard.noValue}</span>
            )}
          </GlobalStat>
        </div>
        {spentLine ? (
          <p className="border-t border-line/60 px-5 py-3 text-sm text-muted sm:px-7">
            <span className="text-foreground/90">{t.dashboard.spent}</span> · {spentLine}
          </p>
        ) : null}
      </section>

      {/* 2. Grille des blocs (ou des catégories scellées) — inutile s'il n'y a qu'un bloc */}
      {!isSealed && gridItems.length === 1 ? null : (
        <Section
          title={isSealed ? t.dashboard.sealedCategories : t.dashboard.blocks}
          hint={isSealed ? t.dashboard.sealedGridHint : undefined}
          action={
            gridItems.length > 1 ? (
              <div role="group" aria-label={t.dashboard.sortGroup} className="flex items-center border border-line">
                <span className="px-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:px-3">
                  {t.dashboard.sortLabel}
                </span>
                {(
                  [
                    ["catalog", t.dashboard.sortCatalog],
                    ["progress", t.dashboard.progress],
                    ["value", t.dashboard.value],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={sort === id}
                    onClick={() => setSort(id)}
                    className={`min-h-10 border-l border-line px-2.5 text-sm sm:px-3.5 ${
                      sort === id ? "bg-panel-2 text-yellow" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null
          }
        >
          {gridItems.length === 0 ? (
            <EmptyPanel>{isSealed ? t.dashboard.emptySealed : t.dashboard.emptyInvestment}</EmptyPanel>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]">
              {sortScopes(gridItems, sort).map((entry) => (
                <GridCard
                  key={entry.key}
                  item={entry}
                  selected={entry.key === current?.key}
                  hasPrices={view.hasPrices}
                  onSelect={() => selectItem(entry)}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* 3. Détail du bloc choisi */}
      {current && scope ? (
        <Section
          title={
            <>
              <span className="text-muted">{t.dashboard.detail} ·</span>{" "}
              <span className="text-yellow">{current.name}</span>
              {pickedExtension ? <span className="text-foreground"> › {pickedExtension.shortName}</span> : null}
            </>
          }
          action={
            <Link
              href={cardsHref({
                set: scope.browseSet,
                language: scope.language,
              })}
              className="border border-line px-3.5 py-2.5 text-sm text-cyan hover:border-cyan hover:text-foreground"
            >
              {isSealed ? t.dashboard.openSealedCategory : t.dashboard.viewSetCards} →
            </Link>
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="flex flex-col gap-4">
              <div className="hud-panel grid grid-cols-3">
                <MiniStat label={t.dashboard.copies} value={formatInt(scope.progress.totalCopies)} />
                <MiniStat
                  label={t.dashboard.missing}
                  value={formatInt(scope.progress.missing)}
                  href={cardsHref({
                    set: scope.browseSet,
                    language: scope.language,
                    collection: "missing",
                  })}
                  tone="danger"
                />
                <MiniStat
                  label={t.dashboard.duplicates}
                  value={formatInt(scope.progress.duplicates)}
                  href={cardsHref({
                    set: scope.browseSet,
                    language: scope.language,
                    collection: "duplicates",
                  })}
                  last
                />
              </div>

              {block ? (
                <div className="hud-panel flex flex-col gap-2 p-5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
                      {t.dashboard.blockExtensions}
                    </h3>
                    {pickedExtension ? (
                      <button
                        type="button"
                        onClick={() => setPick(null)}
                        className="min-h-8 border border-line px-2.5 text-xs text-muted hover:border-cyan hover:text-foreground"
                      >
                        {t.dashboard.wholeBlock}
                      </button>
                    ) : null}
                  </div>
                  {block.extensions.map((extension) => (
                    <PickRow
                      key={extension.key}
                      label={extension.shortName}
                      progress={extension.progress}
                      active={pickedExtension?.key === extension.key}
                      openLabel={t.dashboard.openList}
                      onClick={() => pickRow(extension)}
                    />
                  ))}
                </div>
              ) : null}

              <div className="hud-panel flex items-center justify-between gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {t.dashboard.setValue}
                  </span>
                  <span className="font-mono text-xl text-yellow">
                    {scope.value && scope.value.pricedCopies > 0 ? formatMoney(scope.value.marketTotal) : "—"}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                  {scope.value ? (
                    <TrendBadge delta={scope.value.marketDelta} amount={scope.value.marketDeltaAmount} />
                  ) : null}
                  <span className="text-xs text-muted">
                    {t.dashboard.purchasePnL} <ProfitText value={scope.value?.profitEur ?? null} />
                  </span>
                </div>
              </div>
            </div>

            {isSealed ? (
              <SealedProducts extension={scope} items={items} />
            ) : (
              <DataTable minWidth="420px">
                <thead>
                  <tr>
                    <th>
                      {t.dashboard.byRarity}
                      {pickedExtension ? <span className="ml-2 text-yellow">· {pickedExtension.shortName}</span> : null}
                    </th>
                    <th className="w-20 sm:w-32">{t.dashboard.uniques}</th>
                    <th className="w-[45%]">{t.dashboard.progress}</th>
                  </tr>
                </thead>
                <tbody>
                  {progressByRarity(scope.printings, scope.ownership).map((row) => {
                    const href = cardsHref({
                      set: scope.browseSet,
                      language: scope.language,
                      rarity: row.rarity,
                    });
                    return (
                      <tr key={row.rarity}>
                        <td className="p-0">
                          <Link
                            href={href}
                            className="flex items-center gap-2 px-2.5 py-3 hover:text-cyan sm:px-4"
                            aria-label={t.dashboard.viewRarity(row.rarity)}
                          >
                            <span
                              aria-hidden
                              className="size-2 shrink-0"
                              style={{ background: rarityColor(row.rarity) }}
                            />
                            {row.rarity}
                          </Link>
                        </td>
                        <td className="p-0 font-mono">
                          <Link href={href} tabIndex={-1} aria-hidden className="block px-2.5 py-3 whitespace-nowrap sm:px-4">
                            {formatInt(row.uniqueOwned)} / {formatInt(row.total)}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link href={href} tabIndex={-1} aria-hidden className="flex items-center gap-2 px-2.5 py-3 sm:gap-2.5 sm:px-4">
                            <Bar percent={row.percent} color={rarityColor(row.rarity)} />
                            <span className="w-11 text-right font-mono sm:w-14">{formatPercent(row.percent)}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
          </div>
        </Section>
      ) : null}

      {/* 4. Valeur par extension */}
      <Section
        title={isSealed ? t.dashboard.valueBySealed : t.dashboard.valueBySet}
        hint={isSealed ? t.dashboard.valueBySealedHint : t.dashboard.valueBySetHint}
        action={
          <Link
            href="/investissement"
            className="border border-cyan px-3.5 py-2.5 text-sm text-cyan hover:text-foreground"
          >
            {t.dashboard.viewInvestment} →
          </Link>
        }
      >
        {valueRows.length === 0 ? (
          <EmptyPanel>{isSealed ? t.dashboard.emptySealedInvestment : t.dashboard.emptyInvestment}</EmptyPanel>
        ) : (
          <>
            <ul className="hud-panel md:hidden">
              {valueRows.map(({ key, name, language: rowLanguage, value: row }) => (
                <ValueItem
                  key={key}
                  title={
                    <>
                      <span className={name == null ? "text-muted" : "font-medium"}>{name ?? t.dashboard.otherSets}</span>
                      {rowLanguage ? (
                        <span className="ml-2 text-xs text-muted">
                          {rowLanguage === "fr" ? t.common.french : t.common.english}
                        </span>
                      ) : null}
                    </>
                  }
                  value={row}
                  // Une seule ligne : la part du total vaut 100 %, inutile de l'afficher.
                  share={valueRows.length > 1 && valueTotal > 0 ? (row.marketTotal / valueTotal) * 100 : null}
                />
              ))}
              {globalValue && valueRows.length > 1 ? (
                <ValueItem
                  title={<span className="font-display font-semibold uppercase tracking-[0.08em]">{t.dashboard.total}</span>}
                  value={globalValue}
                  share={null}
                  total
                />
              ) : null}
            </ul>
            <DataTable minWidth="720px" className="hidden md:block">
              <thead>
                <tr>
                  <th>{isSealed ? t.dashboard.sealedCategory : t.dashboard.set}</th>
                  <th className="w-32 text-right">{t.dashboard.copies}</th>
                  <th className="w-32 text-right">{t.dashboard.value}</th>
                  <th className="w-[20%]">{t.dashboard.share}</th>
                  <th className="w-36 text-right">{t.dashboard.marketVar}</th>
                  <th className="w-32 text-right">{t.dashboard.purchasePnL}</th>
                </tr>
              </thead>
              <tbody>
                {valueRows.map(({ key, name, language: rowLanguage, value: row }) => {
                  const share = valueTotal > 0 ? (row.marketTotal / valueTotal) * 100 : 0;
                  return (
                    <tr key={key}>
                      <td className={`px-4 py-3 ${name == null ? "text-muted" : "font-medium"}`}>
                        {name ?? t.dashboard.otherSets}
                        {rowLanguage ? (
                          <span className="ml-2 text-xs font-normal text-muted">
                            {rowLanguage === "fr" ? t.common.french : t.common.english}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatInt(row.pricedCopies)} / {formatInt(row.copies)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {row.pricedCopies > 0 ? formatMoney(row.marketTotal) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <Bar percent={share} tone="cyan" />
                          <span className="w-10 text-right font-mono text-muted">{Math.round(share)} %</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TrendBadge delta={row.marketDelta} amount={row.marketDeltaAmount} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <ProfitText value={row.profitEur} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {globalValue ? (
                <tfoot className="border-t border-[var(--hud-border)]">
                  <tr>
                    <td className="px-4 py-3 font-display font-semibold uppercase tracking-[0.08em]">
                      {t.dashboard.total}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatInt(globalValue.pricedCopies)} / {formatInt(globalValue.copies)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-yellow">{formatMoney(globalValue.marketTotal)}</td>
                    <td />
                    <td className="px-4 py-3 text-right">
                      <TrendBadge delta={globalValue.marketDelta} amount={globalValue.marketDeltaAmount} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <ProfitText value={globalValue.profitEur} />
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </DataTable>
          </>
        )}
      </Section>
    </div>
  );
}

/** Version mobile d'une ligne de « Valeur par extension » : une information par ligne, libellés en clair. */
function ValueItem({
  title,
  value,
  share,
  total = false,
}: {
  title: ReactNode;
  value: ValueSummary;
  share: number | null;
  total?: boolean;
}) {
  const { t } = useI18n();
  return (
    <li className={`px-4 py-3.5 ${total ? "border-t border-[var(--hud-border)]" : "border-t border-line/60 first:border-t-0"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">{title}</span>
        <span className={`shrink-0 font-mono text-base ${total ? "text-yellow" : ""}`}>
          {value.pricedCopies > 0 ? formatMoney(value.marketTotal) : "—"}
        </span>
      </div>
      {share != null ? (
        <div className="mt-2 flex items-center gap-2.5 text-xs">
          <Bar percent={share} tone="cyan" />
          <span className="shrink-0 text-muted">{t.dashboard.valueShare(`${Math.round(share)} %`)}</span>
        </div>
      ) : null}
      <dl className="mt-2.5 flex flex-col gap-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">{t.dashboard.valuePricedCopies}</dt>
          <dd className="font-mono">{t.dashboard.valueCount(formatInt(value.pricedCopies), formatInt(value.copies))}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">{t.dashboard.valueMarketChange}</dt>
          <dd>
            <TrendBadge delta={value.marketDelta} amount={value.marketDeltaAmount} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">{t.dashboard.valuePurchaseGain}</dt>
          <dd>
            {value.profitEur == null ? (
              <span className="text-xs text-muted">{t.dashboard.valueNoPurchase}</span>
            ) : (
              <ProfitText value={value.profitEur} />
            )}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function rarityColor(rarity: string) {
  return rarityFill(rarity) ?? "var(--line)";
}

function GridCard({
  item,
  selected,
  hasPrices,
  onSelect,
}: {
  item: Scope;
  selected: boolean;
  hasPrices: boolean;
  onSelect: () => void;
}) {
  const { progress, value } = item;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex flex-col gap-3.5 rounded-xl border p-5 text-left transition-colors ${
        selected
          ? "border-yellow bg-panel-2 shadow-[inset_0_0_0_1px_var(--yellow)]"
          : "border-[var(--hud-border)] bg-[var(--hud-panel)] shadow-[inset_0_0_0_1px_var(--hud-inset)] hover:border-cyan/60"
      }`}
    >
      <span className="font-display text-[17px] font-semibold uppercase leading-snug tracking-wide text-foreground">
        {item.name}
      </span>
      <span className="flex flex-col gap-2">
        <Bar percent={progress.percent} tone={selected ? "yellow" : "cyan"} />
        <span className="flex justify-between font-mono text-sm text-muted">
          <span>
            <span className="text-foreground">{formatInt(progress.uniqueOwned)}</span> / {formatInt(progress.total)}
          </span>
          <span>{formatPercent(progress.percent)}</span>
        </span>
      </span>
      <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-line/60 pt-3">
        <span className="font-mono text-base text-foreground">
          {hasPrices && value && value.pricedCopies > 0 ? formatMoney(value.marketTotal) : "—"}
        </span>
        {value ? <TrendBadge delta={value.marketDelta} amount={value.marketDeltaAmount} /> : null}
      </span>
    </button>
  );
}

/** Ligne cliquable du bloc : 1er clic sélectionne, 2e clic (ligne active) ouvre les cartes. */
function PickRow({
  label,
  progress,
  active,
  openLabel,
  onClick,
}: {
  label: string;
  progress: Progress;
  active: boolean;
  openLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={active ? openLabel : undefined}
      onClick={onClick}
      className={`group -mx-2 flex min-h-11 items-center gap-2 border px-2 sm:gap-3 text-left transition-colors focus-visible:border-cyan focus-visible:outline-none ${
        active ? "border-yellow/70 bg-panel-2" : "border-transparent hover:border-cyan/50 hover:bg-panel-2"
      }`}
    >
      <span className="w-24 shrink-0 truncate font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground sm:w-44">
        {label}
      </span>
      <Bar percent={progress.percent} tone={active ? "yellow" : "cyan"} thick />
      <span className="w-20 shrink-0 text-right font-mono text-sm text-muted group-hover:text-foreground sm:w-24">
        <span className="text-foreground">{formatInt(progress.uniqueOwned)}</span> / {formatInt(progress.total)}
      </span>
      <span
        aria-hidden
        className={`w-4 shrink-0 text-right text-xs text-cyan transition-opacity sm:w-14 ${active ? "opacity-100" : "opacity-0"}`}
      >
        <span className="hidden sm:inline">{openLabel} </span>→
      </span>
    </button>
  );
}

function SealedProducts({ extension, items }: { extension: Scope; items: { printingId: string; quantity: number }[] }) {
  const { t } = useI18n();
  return (
    <DataTable minWidth="520px">
      <thead>
        <tr>
          <th>{t.dashboard.sealedProduct}</th>
          <th className="w-14 sm:w-28">
            <span className="sm:hidden">{t.investment.qty}</span>
            <span className="hidden sm:inline">{t.dashboard.copies}</span>
          </th>
          <th className="w-28 sm:w-32">{t.dashboard.value}</th>
        </tr>
      </thead>
      <tbody>
        {extension.printings
          .slice()
          .sort((a, b) => (a.localizedName ?? a.setName).localeCompare(b.localizedName ?? b.setName, "fr"))
          .map((printing) => {
            const owned = items
              .filter((item) => item.printingId === printing.id)
              .reduce((sum, item) => sum + item.quantity, 0);
            const unit = printing.marketPrice == null ? null : Number(printing.marketPrice);
            const href = cardsHref({
              set: extension.browseSet,
              language: "en",
              printing: printing.id,
            });
            return (
              <tr key={printing.id}>
                <td className="p-0">
                  <Link href={href} className="block px-2.5 py-3 hover:text-cyan sm:px-4">
                    {printing.localizedName ?? printing.setName}
                  </Link>
                </td>
                <td className="p-0 font-mono">
                  <Link href={href} tabIndex={-1} aria-hidden className="block px-2.5 py-3 sm:px-4">
                    {formatInt(owned)}
                  </Link>
                </td>
                <td className="p-0 font-mono">
                  <Link href={href} tabIndex={-1} aria-hidden className="block px-2.5 py-3 whitespace-nowrap sm:px-4">
                    {unit == null || Number.isNaN(unit)
                      ? "—"
                      : owned > 0
                        ? formatMoney(unit * owned)
                        : formatMoney(unit)}
                  </Link>
                </td>
              </tr>
            );
          })}
      </tbody>
    </DataTable>
  );
}

function ProfitText({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const tone = value > 0.004 ? "text-gain" : value < -0.004 ? "text-danger" : "text-muted";
  return <span className={`font-mono ${tone}`}>{formatSignedMoney(value)}</span>;
}

function Bar({
  percent,
  tone = "cyan",
  color,
  thick = false,
}: {
  percent: number;
  tone?: "cyan" | "yellow";
  color?: string;
  thick?: boolean;
}) {
  return (
    <span className={`block flex-1 bg-panel-2 ${thick ? "h-1.5" : "h-1"}`}>
      <span
        className={`block h-full transition-[width] duration-500 ${color ? "" : tone === "yellow" ? "bg-yellow" : "bg-cyan"}`}
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: color,
        }}
      />
    </span>
  );
}

function GlobalStat({
  label,
  href,
  linkLabel,
  tone,
  last = false,
  children,
}: {
  label: string;
  href?: string;
  linkLabel?: string;
  tone?: "danger";
  last?: boolean;
  children: ReactNode;
}) {
  // Grille 2×2 (téléphone, tablette) puis 4 colonnes : bordures entre les cases seulement.
  const className = `flex min-w-0 flex-col gap-1.5 border-line/60 px-4 py-3.5 odd:border-r [&:nth-child(-n+2)]:border-b sm:px-7 sm:py-4 xl:[&:nth-child(-n+2)]:border-b-0 ${
    last ? "" : "xl:border-r"
  } ${href ? "hover:bg-panel-2/40" : ""}`;
  const body = (
    <>
      <span className="flex flex-wrap justify-between gap-x-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px] sm:tracking-[0.16em]">
        <span>{label}</span>
        {href && linkLabel ? (
          <span className={tone === "danger" ? "text-danger" : "text-cyan"}>{linkLabel} →</span>
        ) : null}
      </span>
      <span className="flex flex-wrap items-baseline gap-2.5">{children}</span>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function MiniStat({
  label,
  value,
  href,
  tone,
  last = false,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: "danger";
  last?: boolean;
}) {
  const className = `flex flex-col gap-1 px-4 py-4 sm:px-5 ${last ? "" : "border-r border-line/60"} ${
    href ? "hover:bg-panel-2/40" : ""
  }`;
  const body = (
    <>
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className={`font-mono text-xl ${tone === "danger" ? "text-danger" : "text-foreground"}`}>{value}</span>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function SegmentGroup({
  children,
  ariaLabel,
  grow = false,
}: {
  children: ReactNode;
  ariaLabel: string;
  grow?: boolean;
}) {
  return (
    <div className={`flex border border-line ${grow ? "flex-1" : ""}`} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`min-h-11 flex-1 px-4 text-sm font-medium transition-colors ${
        active ? "bg-yellow text-black" : "text-muted hover:text-foreground"
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[88px] shrink-0 sm:size-[104px]" aria-hidden>
      <svg viewBox="0 0 104 104" className="size-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--yellow)"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base text-yellow sm:text-lg">{label}</span>
      </span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">{title}</h2>
          {hint ? <p className="text-sm text-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return <p className="hud-panel px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

/** Sur mobile la largeur minimale est ignorée : le tableau tient dans l'écran au lieu de défiler. */
function DataTable({ minWidth, className = "", children }: { minWidth: string; className?: string; children: ReactNode }) {
  return (
    <div className={`hud-panel relative overflow-x-auto scrollbar-hud ${className}`}>
      <table
        className="w-full text-left text-sm md:min-w-[var(--table-min)] [&_tbody_tr]:border-t [&_tbody_tr]:border-line/60 [&_tbody_tr:first-child]:border-t-0 [&_tbody_tr:hover]:bg-cyan/[0.04] [&_thead]:border-b [&_thead]:border-[var(--hud-border)] [&_th]:px-2.5 [&_th]:py-3 [&_th]:font-display [&_th]:text-[10px] sm:[&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.04em] [&_th]:text-muted sm:[&_th]:whitespace-nowrap sm:[&_th]:px-4 sm:[&_th]:tracking-[0.12em]"
        style={{ "--table-min": minWidth } as CSSProperties}
      >
        {children}
      </table>
    </div>
  );
}

function EmptyCatalog() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="hud-panel p-8">
        <h1 className="text-2xl text-yellow">{t.dashboard.emptyTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {t.dashboard.emptyBody} <code className="text-cyan">npm run import:cards</code>.
        </p>
      </div>
    </div>
  );
}
