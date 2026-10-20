"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import type { ChartPoint } from "@/components/PriceChart";
import { useCollection } from "@/components/CollectionProvider";
import { fetchCached, readCached } from "@/components/data-cache";
import { InvestmentChart, chartRangeStart, filterChartRange, type ChartRange } from "@/components/investment/InvestmentChart";
import { InvestmentFilters } from "@/components/investment/InvestmentFilters";
import { LineTable } from "@/components/investment/LineTable";
import { SetTable } from "@/components/investment/SetTable";
import {
  sortLineRows,
  sortSetRows,
  type LineSortKey,
  type SetSortKey,
  type SortState,
} from "@/components/investment/sorting";
import { SetChip, SummaryStat } from "@/components/investment/ui";
import { ScreenError, ScreenSkeleton, SkeletonBlock, SkeletonRows } from "@/components/site/ScreenSkeleton";
import {
  applyInvestmentPeriod,
  buildInvestmentLines,
  filterInvestmentLines,
  investmentBySet,
  summarizeInvestment,
  type InvestmentPerformance,
} from "@/lib/logic";
import {
  CARDS_GROUP_FILTER,
  isSealedSetCode,
  partitionCatalogSets,
  SEALED_GROUP_FILTER,
} from "@/lib/reference-data";

function languageParam(value: string | null) {
  return value === "en" || value === "fr" ? value : "";
}

export function InvestmentScreen() {
  const fmt = useNumberFormat();
  const { ready, error, retry, catalog, items } = useCollection();
  const t = useTranslations();
  // Filtres initiaux passés par l'URL (ex. clic sur une extension du tableau de bord).
  const searchParams = useSearchParams();
  const [setFilter, setSetFilter] = useState(() => searchParams.get("set") || "all");
  const [language, setLanguage] = useState(() => languageParam(searchParams.get("language")));
  const searchKey = searchParams.toString();
  const [syncedSearchKey, setSyncedSearchKey] = useState(searchKey);
  if (searchKey !== syncedSearchKey) {
    setSyncedSearchKey(searchKey);
    setSetFilter(searchParams.get("set") || "all");
    setLanguage(languageParam(searchParams.get("language")));
  }
  const [performance, setPerformance] = useState<InvestmentPerformance>("all");
  const [query, setQuery] = useState("");
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartStatus, setChartStatus] = useState<"loading" | "ready" | "error">("loading");
  const [chartRange, setChartRange] = useState<ChartRange>("all");
  // Après le premier chargement, le graphique reste affiché pendant les rechargements (pas de saut de mise en page).
  const [chartLoaded, setChartLoaded] = useState(false);
  // Incrémenté par « Réessayer » : relance le chargement de l'historique.
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const rangedChartPoints = useMemo(() => filterChartRange(chartPoints, chartRange), [chartPoints, chartRange]);
  const periodStart = useMemo(() => chartRangeStart(chartPoints, chartRange), [chartPoints, chartRange]);
  const [reference, setReference] = useState<{ day: string | null; prices: Record<string, number> } | null>(null);
  const [setSort, setSetSort] = useState<SortState<SetSortKey> | null>(null);
  const [lineSort, setLineSort] = useState<SortState<LineSortKey> | null>(null);
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

  // La liste par extension ignore le filtre d'extension : elle reste complète et sert de sélecteur,
  // l'extension choisie y est simplement surlignée (pas de liste qui se réduit à une ligne).
  const filteredAnySet = useMemo(
    () => filterInvestmentLines(allLines, { set: "all", language, performance, q: query }),
    [allLines, language, performance, query],
  );

  const summary = useMemo(() => summarizeInvestment(filtered), [filtered]);
  const bySet = useMemo(
    () => (catalog ? investmentBySet(filteredAnySet, catalog.sets) : []),
    [catalog, filteredAnySet],
  );
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
      const params = new URLSearchParams();
      if (setFilter && setFilter !== "all") params.set("set", setFilter);
      if (language) params.set("language", language);
      const url = `/api/investment/history?${params}`;
      type HistoryBody = { points?: { day: string; marketTotal: number }[] };
      const show = (body: HistoryBody) => {
        setChartPoints((body.points ?? []).map((point) => ({ day: point.day, value: point.marketTotal })));
        setChartStatus("ready");
        setChartLoaded(true);
      };
      // Dernière courbe connue pour ces filtres affichée aussitôt, puis mise à jour.
      const cached = readCached<HistoryBody>(url);
      if (cached) show(cached);
      else setChartStatus("loading");
      try {
        const body = await fetchCached<HistoryBody>(url);
        if (!cancelled) show(body);
      } catch {
        if (!cancelled && !cached) {
          setChartPoints([]);
          setChartStatus("error");
        }
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [catalog, historyAttempt, items, language, ready, setFilter]);

  useEffect(() => {
    if (!ready || !catalog || chartStatus !== "ready") return;
    let cancelled = false;
    async function loadReference() {
      const url = `/api/investment/history?${new URLSearchParams({ referenceDay: periodStart ?? "" })}`;
      type ReferenceBody = { prices?: Record<string, number> };
      const cached = readCached<ReferenceBody>(url);
      if (cached) setReference({ day: periodStart, prices: cached.prices ?? {} });
      try {
        const body = await fetchCached<ReferenceBody>(url);
        if (!cancelled) setReference({ day: periodStart, prices: body.prices ?? {} });
      } catch {
        if (!cancelled && !cached) setReference(null);
      }
    }
    void loadReference();
    return () => {
      cancelled = true;
    };
  }, [catalog, chartStatus, items, periodStart, ready]);

  const selectedSetLabel =
    setFilter === "all"
      ? null
      : setFilter === CARDS_GROUP_FILTER
        ? t("investment.groupCards")
        : setFilter === SEALED_GROUP_FILTER
          ? t("investment.groupSealed")
          : (catalog?.sets.find((set) => set.code === setFilter)?.name ?? setFilter);

  // Re-cliquer l'extension sélectionnée la désélectionne (évite de remonter aux filtres sur mobile).
  const toggleSet = (code: string) => setSetFilter((current) => (current === code ? "all" : code));

  const renderSetChip = () =>
    selectedSetLabel ? (
      <SetChip label={selectedSetLabel} ariaLabel={t("investment.clearSet", { set: selectedSetLabel })} onClear={() => setSetFilter("all")} />
    ) : null;

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6">
        <ScreenError message={error} onRetry={retry} />
      </div>
    );
  }
  if (!ready || !catalog) return <InvestmentSkeleton />;
  if (catalog.printings.length === 0) {
    return (
      <p className="p-6 text-sm text-muted">
        {t("investment.emptyCatalog")} <code className="text-cyan">npm run import:cards</code>.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5 px-3 py-4 sm:gap-8 sm:px-4 sm:py-6">
      <h1 className="text-2xl text-yellow sm:text-4xl">{t("investment.eyebrow")}</h1>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <SummaryStat
          label={t("investment.marketValue")}
          value={summary.pricedCopies > 0 ? fmt.money(summary.marketTotal) : "—"}
          delta={summary.marketDelta}
          deltaAmount={summary.marketDeltaAmount}
        />
        <SummaryStat
          label={t("investment.invested")}
          value={summary.investedEur > 0 ? fmt.money(summary.investedEur) : "—"}
        />
        <SummaryStat
          label={t("investment.pnl")}
          value={summary.profitEur == null ? "—" : fmt.money(summary.profitEur)}
          tone={summary.profitEur == null ? undefined : summary.profitEur >= 0 ? "gain" : "loss"}
        />
        <SummaryStat
          label={t("investment.trackedCopies")}
          value={`${fmt.int(summary.pricedCopies)} / ${fmt.int(summary.copies)}`}
        />
      </section>

      {!catalog.hasPrices ? (
        <p className="text-sm text-muted">
          {t("investment.noPrices")} <code className="text-cyan">npm run import:prices</code>.
        </p>
      ) : null}

      <InvestmentFilters
        setFilter={setFilter}
        setSetFilter={setSetFilter}
        language={language}
        setLanguage={setLanguage}
        performance={performance}
        setPerformance={setPerformance}
        query={query}
        setQuery={setQuery}
        setOptions={setOptions}
      />

      <InvestmentChart
        chartRange={chartRange}
        setChartRange={setChartRange}
        chartStatus={chartStatus}
        chartLoaded={chartLoaded}
        rangedChartPoints={rangedChartPoints}
        onRetry={() => {
          setChartStatus("loading");
          setHistoryAttempt((current) => current + 1);
        }}
      />

      <SetTable
        bySet={bySet}
        sortedCardSets={sortedCardSets}
        sortedSealedSets={sortedSealedSets}
        setFilter={setFilter}
        toggleSet={toggleSet}
        setSort={setSort}
        effectiveSetSort={effectiveSetSort}
        setSetSort={setSetSort}
        setChip={renderSetChip()}
      />

      <LineTable
        filtered={filtered}
        sortedLines={sortedLines}
        lineSort={lineSort}
        effectiveLineSort={effectiveLineSort}
        setLineSort={setLineSort}
        setChip={renderSetChip()}
      />
    </div>
  );
}

/** Squelette de l'investissement : titre, quatre chiffres, filtres, courbe et tableau. */
export function InvestmentSkeleton() {
  const t = useTranslations();
  return (
    <ScreenSkeleton
      label={t("investment.loading")}
      className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5 px-3 py-4 sm:gap-8 sm:px-4 sm:py-6"
    >
      <SkeletonBlock className="h-8 w-48 sm:h-10" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className="h-20" />
        ))}
      </div>
      <SkeletonBlock className="h-11 w-full max-w-2xl" />
      <SkeletonBlock className="h-[280px]" />
      <SkeletonRows rows={6} />
    </ScreenSkeleton>
  );
}
