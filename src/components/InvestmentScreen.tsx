"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { PriceChart, type ChartPoint } from "@/components/PriceChart";
import { TrendBadge, formatSignedMoney } from "@/components/TrendBadge";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import {
  applyInvestmentPeriod,
  buildInvestmentLines,
  filterInvestmentLines,
  formatInt,
  formatMoney,
  investmentBySet,
  summarizeInvestment,
  type InvestmentLine,
  type InvestmentPerformance,
  type PriceMovement,
  type SetInvestment,
} from "@/lib/logic";
import {
  CARDS_GROUP_FILTER,
  isSealedSetCode,
  partitionCatalogSets,
  SEALED_GROUP_FILTER,
} from "@/lib/reference-data";
import type { Messages } from "@/lib/i18n/messages";

type SortDir = "asc" | "desc";

type SetSortKey = "set" | "copies" | "marketValue" | "marketVar" | "invested" | "purchasePnL";
type LineSortKey = "card" | "set" | "qty" | "purchase" | "market" | "marketVar" | "purchasePnL";

type SortState<K extends string> = { key: K; dir: SortDir };

// Décale les extensions sous leur groupe dans le menu (les <option> ignorent le padding).
const SET_OPTION_INDENT = "\u00a0\u00a0\u00a0";

// Colonnes de droite : l’infobulle s’aligne à droite pour ne pas déborder de l’écran.
const RIGHT_HINT_COLUMNS = new Set<string>(["marketVar", "invested", "purchasePnL"]);

type ChartRange = "1d" | "1w" | "1m" | "1y" | "all";

const CHART_RANGE_DAYS: Record<ChartRange, number | null> = { "1d": 1, "1w": 7, "1m": 30, "1y": 365, all: null };

function chartRangeOptions(t: Messages): { value: ChartRange; label: string }[] {
  return [
    { value: "1d", label: t.investment.range1d },
    { value: "1w", label: t.investment.range1w },
    { value: "1m", label: t.investment.range1m },
    { value: "1y", label: t.investment.range1y },
    { value: "all", label: t.investment.rangeAll },
  ];
}

/** Premier jour de la fenêtre, compté depuis le dernier point connu (nul = tout l’historique). */
function chartRangeStart(points: ChartPoint[], range: ChartRange) {
  const days = CHART_RANGE_DAYS[range];
  if (days == null) return null;
  const last = new Date(`${points.length > 0 ? points[points.length - 1].day : new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  last.setUTCDate(last.getUTCDate() - days);
  return last.toISOString().slice(0, 10);
}

/** Garde les points dont le jour est dans la fenêtre. */
function filterChartRange(points: ChartPoint[], range: ChartRange) {
  const cutoff = chartRangeStart(points, range);
  if (cutoff == null) return points;
  return points.filter((point) => point.day >= cutoff);
}

/** Colonnes monétaires / numériques : premier clic = décroissant (plus cher / plus fort d’abord). */
const DESC_FIRST_COLUMNS = new Set<string>([
  "copies",
  "qty",
  "marketValue",
  "marketVar",
  "invested",
  "purchasePnL",
  "purchase",
  "market",
]);

function initialSortDir(columnKey: string): SortDir {
  return DESC_FIRST_COLUMNS.has(columnKey) ? "desc" : "asc";
}

function performanceOptions(t: Messages): { value: InvestmentPerformance; label: string }[] {
  return [
    { value: "all", label: t.investment.perfAll },
    { value: "profit", label: t.investment.perfProfit },
    { value: "loss", label: t.investment.perfLoss },
    { value: "flat", label: t.investment.perfFlat },
    { value: "unknown", label: t.investment.perfUnknown },
    { value: "rising", label: t.investment.perfRising },
    { value: "falling", label: t.investment.perfFalling },
  ];
}

export function InvestmentScreen() {
  const { ready, error, catalog, items } = useCollection();
  const { t } = useI18n();
  const [setFilter, setSetFilter] = useState("all");
  const [language, setLanguage] = useState("");
  const [performance, setPerformance] = useState<InvestmentPerformance>("all");
  const [query, setQuery] = useState("");
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartStatus, setChartStatus] = useState<"loading" | "ready" | "error">("loading");
  const [chartRange, setChartRange] = useState<ChartRange>("all");
  const rangedChartPoints = useMemo(() => filterChartRange(chartPoints, chartRange), [chartPoints, chartRange]);
  const periodStart = useMemo(() => chartRangeStart(chartPoints, chartRange), [chartPoints, chartRange]);
  const [reference, setReference] = useState<{ day: string | null; prices: Record<string, number> } | null>(null);
  const [setSort, setSetSort] = useState<SortState<SetSortKey> | null>(null);
  const [lineSort, setLineSort] = useState<SortState<LineSortKey> | null>(null);
  const PERFORMANCE_OPTIONS = performanceOptions(t);
  const effectiveSetSort = setSort ?? ({ key: "marketValue", dir: "desc" } as SortState<SetSortKey>);
  const effectiveLineSort = lineSort ?? ({ key: "market", dir: "desc" } as SortState<LineSortKey>);

  const cardsById = useMemo(() => new Map(catalog?.cards.map((card) => [card.id, card]) ?? []), [catalog]);

  const baseLines = useMemo(() => {
    if (!catalog) return [];
    return buildInvestmentLines(items, catalog.printings, cardsById);
  }, [cardsById, catalog, items]);

  // Var. marché et P&L suivent la durée choisie, dès que les prix de référence sont chargés.
  const allLines = useMemo(() => {
    if (!reference || reference.day !== periodStart) return baseLines;
    const addedAtById = new Map(items.map((item) => [item.id, item.addedAt]));
    return applyInvestmentPeriod(baseLines, reference.prices, periodStart, addedAtById);
  }, [baseLines, items, periodStart, reference]);

  const filtered = useMemo(
    () =>
      filterInvestmentLines(allLines, {
        set: setFilter,
        language,
        performance,
        q: query,
      }),
    [allLines, language, performance, query, setFilter],
  );

  const summary = useMemo(() => summarizeInvestment(filtered), [filtered]);
  const bySet = useMemo(() => (catalog ? investmentBySet(filtered, catalog.sets) : []), [catalog, filtered]);
  const sortedBySet = useMemo(() => sortSetRows(bySet, effectiveSetSort), [bySet, effectiveSetSort]);
  const sortedCardSets = useMemo(
    () => sortedBySet.filter((row) => !isSealedSetCode(row.setCode)),
    [sortedBySet],
  );
  const sortedSealedSets = useMemo(
    () => sortedBySet.filter((row) => isSealedSetCode(row.setCode)),
    [sortedBySet],
  );
  const sortedLines = useMemo(() => sortLineRows(filtered, effectiveLineSort), [filtered, effectiveLineSort]);
  const setOptions = useMemo(() => {
    if (!catalog) return { cardSets: [], sealedSets: [] };
    const owned = new Set(allLines.map((line) => line.setCode));
    const ownedSets = catalog.sets.filter((set) => owned.has(set.code));
    return partitionCatalogSets(ownedSets);
  }, [allLines, catalog]);

  useEffect(() => {
    if (!ready || !catalog) return;
    let cancelled = false;
    async function loadHistory() {
      setChartStatus("loading");
      try {
        const params = new URLSearchParams();
        if (setFilter && setFilter !== "all") params.set("set", setFilter);
        if (language) params.set("language", language);
        const response = await fetch(`/api/investment/history?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("history");
        const body = (await response.json()) as { points?: { day: string; marketTotal: number }[] };
        if (cancelled) return;
        setChartPoints((body.points ?? []).map((point) => ({ day: point.day, value: point.marketTotal })));
        setChartStatus("ready");
      } catch {
        if (!cancelled) {
          setChartPoints([]);
          setChartStatus("error");
        }
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [catalog, items, language, ready, setFilter]);

  useEffect(() => {
    if (!ready || !catalog || chartStatus !== "ready") return;
    let cancelled = false;
    async function loadReference() {
      try {
        const params = new URLSearchParams({ referenceDay: periodStart ?? "" });
        const response = await fetch(`/api/investment/history?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("reference");
        const body = (await response.json()) as { prices?: Record<string, number> };
        if (!cancelled) setReference({ day: periodStart, prices: body.prices ?? {} });
      } catch {
        if (!cancelled) setReference(null);
      }
    }
    void loadReference();
    return () => {
      cancelled = true;
    };
  }, [catalog, chartStatus, items, periodStart, ready]);

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!ready || !catalog) return <p className="p-6 text-muted">{t.investment.loading}</p>;
  if (catalog.printings.length === 0) {
    return (
      <p className="p-6 text-sm text-muted">
        {t.investment.emptyCatalog} <code className="text-cyan">npm run import:cards</code>.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-8 px-4 py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl text-yellow sm:text-4xl">{t.investment.eyebrow}</h1>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          label={t.investment.marketValue}
          value={summary.pricedCopies > 0 ? formatMoney(summary.marketTotal) : "—"}
          delta={summary.marketDelta}
          deltaAmount={summary.marketDeltaAmount}
        />
        <SummaryStat
          label={t.investment.invested}
          value={summary.investedEur > 0 ? formatMoney(summary.investedEur) : "—"}
        />
        <SummaryStat
          label={t.investment.pnl}
          value={summary.profitEur == null ? "—" : formatMoney(summary.profitEur)}
          tone={summary.profitEur == null ? undefined : summary.profitEur >= 0 ? "gain" : "loss"}
        />
        <SummaryStat
          label={t.investment.trackedCopies}
          value={`${formatInt(summary.pricedCopies)} / ${formatInt(summary.copies)}`}
        />
      </section>

      {!catalog.hasPrices ? (
        <p className="text-sm text-muted">
          {t.investment.noPrices} <code className="text-cyan">npm run import:prices</code>.
        </p>
      ) : null}

      <section className="grid gap-3 border border-line bg-panel p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.investment.set}</span>
          <select
            className="h-10 w-full border border-line bg-background px-3 outline-none focus:border-cyan"
            value={setFilter}
            onChange={(event) => setSetFilter(event.target.value)}
          >
            <option value="all">{t.investment.allSets}</option>
            {setOptions.cardSets.length > 0 ? (
              <>
                <option value={CARDS_GROUP_FILTER} className="font-semibold">
                  {t.investment.groupCards}
                </option>
                {setOptions.cardSets.map((set) => (
                  <option key={set.code} value={set.code}>
                    {SET_OPTION_INDENT}
                    {set.name}
                  </option>
                ))}
              </>
            ) : null}
            {setOptions.sealedSets.length > 0 ? (
              <>
                <option value={SEALED_GROUP_FILTER} className="font-semibold">
                  {t.investment.groupSealed}
                </option>
                {setOptions.sealedSets.map((set) => (
                  <option key={set.code} value={set.code}>
                    {SET_OPTION_INDENT}
                    {set.name}
                  </option>
                ))}
              </>
            ) : null}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.investment.language}</span>
          <select
            className="h-10 w-full border border-line bg-background px-3 outline-none focus:border-cyan"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">{t.investment.allLanguages}</option>
            <option value="en">{t.common.english}</option>
            <option value="fr">{t.common.french}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.investment.performance}</span>
          <select
            className="h-10 w-full border border-line bg-background px-3 outline-none focus:border-cyan"
            value={performance}
            onChange={(event) => setPerformance(event.target.value as InvestmentPerformance)}
          >
            {PERFORMANCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.investment.range}</span>
          <select
            className="h-10 w-full border border-line bg-background px-3 outline-none focus:border-cyan"
            value={chartRange}
            onChange={(event) => setChartRange(event.target.value as ChartRange)}
          >
            {chartRangeOptions(t).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.investment.search}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.investment.searchPlaceholder}
            className="h-10 w-full border border-line bg-background px-3 outline-none focus:border-cyan"
          />
        </label>
      </section>

      <section>
        {chartStatus === "loading" ? (
          <p className="border border-line bg-panel px-4 py-8 text-sm text-muted">{t.investment.chartLoading}</p>
        ) : chartStatus === "error" ? (
          <p className="border border-line bg-panel px-4 py-8 text-sm text-danger">{t.investment.chartError}</p>
        ) : (
          <PriceChart
            points={rangedChartPoints}
            label={t.investment.chartLabel}
            emptyHint={t.investment.chartEmpty}
          />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg">{t.investment.bySet}</h2>          </div>
        </div>
        {bySet.length === 0 ? (
          <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t.investment.emptyFiltered}</p>
        ) : (
          <div className="border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <SortableTh
                    label={t.investment.set}
                    columnKey="set"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.copies}
                    columnKey="copies"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.marketValue}
                    columnKey="marketValue"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.marketVar}
                    columnKey="marketVar"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.investedCol}
                    columnKey="invested"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.purchasePnL}
                    columnKey="purchasePnL"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedCardSets.length > 0 && (sortedSealedSets.length > 0 || setFilter === CARDS_GROUP_FILTER) ? (
                  <GroupRow
                    label={t.investment.groupCards}
                    active={setFilter === CARDS_GROUP_FILTER}
                    onSelect={() => setSetFilter((current) => (current === CARDS_GROUP_FILTER ? "all" : CARDS_GROUP_FILTER))}
                  />
                ) : null}
                {sortedCardSets.map((row) => (
                  <SetRow key={row.setCode} row={row} onOpen={() => setSetFilter(row.setCode)} />
                ))}
                {sortedSealedSets.length > 0 ? (
                  <GroupRow
                    label={t.investment.groupSealed}
                    active={setFilter === SEALED_GROUP_FILTER}
                    onSelect={() => setSetFilter((current) => (current === SEALED_GROUP_FILTER ? "all" : SEALED_GROUP_FILTER))}
                  />
                ) : null}
                {sortedSealedSets.map((row) => (
                  <SetRow key={row.setCode} row={row} onOpen={() => setSetFilter(row.setCode)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg">{t.investment.detail}</h2>
        <p className="mb-3 text-sm text-muted">
          {t.investment.detailHint(formatInt(filtered.length), t.common.lines(filtered.length))}
        </p>
        {filtered.length === 0 ? (
          <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t.investment.noResults}</p>
        ) : (
          <div className="border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <SortableTh
                    label={t.investment.card}
                    columnKey="card"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.set}
                    columnKey="set"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.qty}
                    columnKey="qty"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.purchase}
                    columnKey="purchase"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.market}
                    columnKey="market"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.marketVar}
                    columnKey="marketVar"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t.investment.purchasePnL}
                    columnKey="purchasePnL"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedLines.map((line) => (
                  <LineRow key={line.itemId} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SortableTh<K extends string>({
  label,
  columnKey,
  sort,
  onSort,
  t,
}: {
  label: string;
  columnKey: K;
  sort: SortState<K> | null;
  onSort: (next: SortState<K>) => void;
  t: Messages;
}) {
  const active = sort != null && sort.key === columnKey;
  const nextDir: SortDir = active ? (sort.dir === "asc" ? "desc" : "asc") : initialSortDir(columnKey);
  const directionLabel = nextDir === "asc" ? t.investment.sortAsc : t.investment.sortDesc;
  const hint = (t.investment.colHints as Record<string, string>)[columnKey];
  const hintId = useId();
  const alignRight = RIGHT_HINT_COLUMNS.has(columnKey);

  return (
    <th
      className={`group relative border-b-2 px-1 py-0 font-medium ${
        active ? "border-cyan bg-cyan/10 text-cyan" : "border-transparent"
      }`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-1.5 px-2 py-2 text-left transition-colors hover:text-cyan ${
          active ? "text-cyan" : "text-muted"
        }`}
        onClick={() => onSort({ key: columnKey, dir: nextDir })}
        aria-label={t.investment.sortBy(label, directionLabel)}
        aria-describedby={hint ? hintId : undefined}
      >
        <span className="min-w-0 flex-1">{label}</span>
        <SortArrow active={active} dir={active ? sort.dir : null} />
      </button>
      {hint ? (
        <span
          id={hintId}
          role="tooltip"
          className={`pointer-events-none invisible absolute top-full z-20 mt-1.5 w-64 border border-cyan/50 bg-black/95 px-3 py-2 text-xs leading-relaxed font-normal normal-case tracking-normal text-foreground opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-opacity delay-150 duration-150 group-hover:visible group-hover:opacity-100 group-has-[:focus-visible]:visible group-has-[:focus-visible]:opacity-100 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {hint}
        </span>
      ) : null}
    </th>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir | null }) {
  if (!active || !dir) {
    return (
      <span className="inline-flex w-3 shrink-0 flex-col items-center gap-0.5 opacity-35" aria-hidden>
        <span className="h-0 w-0 border-x-[3px] border-b-[4px] border-x-transparent border-b-current" />
        <span className="h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-current" />
      </span>
    );
  }
  return (
    <span className="inline-flex w-3 shrink-0 flex-col items-center" aria-hidden>
      {dir === "asc" ? (
        <span className="h-0 w-0 border-x-[4px] border-b-[5px] border-x-transparent border-b-current" />
      ) : (
        <span className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current" />
      )}
    </span>
  );
}

function sortSetRows(rows: SetInvestment[], sort: SortState<SetSortKey>) {
  const list = [...rows];
  list.sort((left, right) => {
    let result = 0;
    switch (sort.key) {
      case "set":
        result = directedText(left.setName, right.setName, sort.dir);
        break;
      case "copies":
        result = directedNumber(left.copies, right.copies, sort.dir);
        break;
      case "marketValue":
        result = directedNumber(left.marketTotal, right.marketTotal, sort.dir);
        break;
      case "marketVar":
        result = directedNullableNumber(movingAmount(left.marketDeltaAmount), movingAmount(right.marketDeltaAmount), sort.dir);
        break;
      case "invested":
        result = directedNumber(left.investedEur, right.investedEur, sort.dir);
        break;
      case "purchasePnL":
        result = directedNullableNumber(left.profitEur, right.profitEur, sort.dir);
        break;
    }
    if (result === 0) result = left.sortOrder - right.sortOrder || compareText(left.setName, right.setName);
    return result;
  });
  return list;
}

function sortLineRows(rows: InvestmentLine[], sort: SortState<LineSortKey>) {
  const list = [...rows];
  list.sort((left, right) => {
    let result = 0;
    switch (sort.key) {
      case "card":
        result =
          directedText(left.title, right.title, sort.dir) ||
          directedText(left.collectorNumber, right.collectorNumber, sort.dir);
        break;
      case "set":
        result =
          directedText(left.setName, right.setName, sort.dir) ||
          directedText(left.collectorNumber, right.collectorNumber, sort.dir);
        break;
      case "qty":
        result = directedNumber(left.quantity, right.quantity, sort.dir);
        break;
      case "purchase":
        result = directedNullableNumber(left.purchaseTotal, right.purchaseTotal, sort.dir);
        break;
      case "market":
        // Toujours le prix Cardmarket actuel (marketUnit), pas previousMarketUnit.
        result =
          directedNullableNumber(left.marketUnit, right.marketUnit, sort.dir) ||
          directedNullableNumber(left.marketTotal, right.marketTotal, sort.dir);
        break;
      case "marketVar":
        result = directedNullableNumber(movingAmount(lineMarketDelta(left)), movingAmount(lineMarketDelta(right)), sort.dir);
        break;
      case "purchasePnL":
        result = directedNullableNumber(left.profit, right.profit, sort.dir);
        break;
    }
    if (result === 0) {
      result =
        compareText(left.setName, right.setName) ||
        compareText(left.collectorNumber, right.collectorNumber) ||
        compareText(left.itemId, right.itemId);
    }
    return result;
  });
  return list;
}

function lineMarketDelta(line: InvestmentLine) {
  if (line.marketUnit == null || line.previousMarketUnit == null) return null;
  return (line.marketUnit - line.previousMarketUnit) * line.quantity;
}

/** Variation nulle (« — ») : rangée avec les lignes sans variation, toujours en fin de liste. */
function movingAmount(value: number | null) {
  return value == null || Math.abs(value) < 0.005 ? null : value;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

function directedText(left: string, right: string, dir: SortDir) {
  const result = compareText(left, right);
  return dir === "asc" ? result : -result;
}

function directedNumber(left: number, right: number, dir: SortDir) {
  const result = left - right;
  return dir === "asc" ? result : -result;
}

/** Valeurs nulles toujours en fin de liste, quel que soit le sens. */
function directedNullableNumber(left: number | null | undefined, right: number | null | undefined, dir: SortDir) {
  const leftNull = left == null || !Number.isFinite(left);
  const rightNull = right == null || !Number.isFinite(right);
  if (leftNull && rightNull) return 0;
  if (leftNull) return 1;
  if (rightNull) return -1;
  return directedNumber(left, right, dir);
}

function SummaryStat({
  label,
  value,
  delta,
  deltaAmount,
  tone,
}: {
  label: string;
  value: string;
  delta?: PriceMovement;
  deltaAmount?: number | null;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <p className="text-xs tracking-[0.14em] text-muted uppercase">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-2xl ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-danger" : "text-foreground"}`}>
          {value}
        </p>
        {delta && deltaAmount != null ? <TrendBadge delta={delta} amount={deltaAmount} /> : null}
      </div>
    </div>
  );
}

function GroupRow({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <tr className={`border-t border-line ${active ? "bg-cyan/10" : "bg-panel-2/60"}`}>
      <td colSpan={6} className="p-0">
        <button
          type="button"
          aria-pressed={active}
          className={`block w-full px-3 py-2 text-left text-xs tracking-wide hover:text-cyan ${
            active ? "text-cyan" : "text-muted"
          }`}
          onClick={onSelect}
        >
          {label}
        </button>
      </td>
    </tr>
  );
}

function SetRow({ row, onOpen }: { row: SetInvestment; onOpen: () => void }) {
  return (
    <tr className="border-t border-line hover:bg-white/5">
      <td className="p-0">
        <button type="button" className="block w-full px-3 py-2 text-left hover:text-cyan" onClick={onOpen}>
          {row.setName}
        </button>
      </td>
      <td className="px-3 py-2 font-mono">
        {formatInt(row.pricedCopies)} / {formatInt(row.copies)}
      </td>
      <td className="px-3 py-2 font-mono">{row.pricedCopies > 0 ? formatMoney(row.marketTotal) : "—"}</td>
      <td className="px-3 py-2">
        <TrendBadge delta={row.marketDelta} amount={row.marketDeltaAmount} />
      </td>
      <td className="px-3 py-2 font-mono">{row.investedLines > 0 ? formatMoney(row.investedEur) : "—"}</td>
      <td className={`px-3 py-2 font-mono ${profitClass(row.profitEur)}`}>
        {row.profitEur == null ? "—" : formatSignedMoney(row.profitEur)}
      </td>
    </tr>
  );
}

function LineRow({ line }: { line: InvestmentLine }) {
  const href = `/cards?set=${encodeURIComponent(line.setCode)}&language=${line.language}&printing=${line.printingId}`;
  return (
    <tr className="border-t border-line hover:bg-white/5">
      <td className="p-0">
        <Link href={href} className="flex items-center gap-3 px-3 py-2 hover:text-cyan">
          {line.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={line.imagePath} alt="" className="h-12 w-9 bg-black object-contain" loading="lazy" />
          ) : (
            <div className="grid h-12 w-9 place-items-center bg-black text-[10px] text-muted">N/A</div>
          )}
          <span>
            <span className="block font-mono text-xs text-muted">#{line.collectorNumber}</span>
            <span className="block">{line.title}</span>
            <span className="block text-xs text-muted">
              {line.conditionCode}
              {line.rarity ? ` · ${line.rarity}` : ""}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-muted">{line.setName}</td>
      <td className="px-3 py-2 font-mono">×{line.quantity}</td>
      <td className="px-3 py-2 font-mono">
        {line.purchaseTotal == null
          ? "—"
          : formatMoney(line.purchaseTotal, line.purchaseCurrency || "EUR")}
      </td>
      <td className="px-3 py-2 font-mono">{line.marketTotal == null ? "—" : formatMoney(line.marketTotal)}</td>
      <td className="px-3 py-2">
        <TrendBadge
          delta={line.marketDelta}
          amount={
            line.marketUnit != null && line.previousMarketUnit != null
              ? (line.marketUnit - line.previousMarketUnit) * line.quantity
              : null
          }
        />
      </td>
      <td className={`px-3 py-2 font-mono ${profitClass(line.profit)}`}>
        {line.profit == null ? "—" : formatSignedMoney(line.profit)}
      </td>
    </tr>
  );
}

function profitClass(value: number | null) {
  if (value == null) return "text-muted";
  if (value > 0.004) return "text-gain";
  if (value < -0.004) return "text-danger";
  return "text-muted";
}
