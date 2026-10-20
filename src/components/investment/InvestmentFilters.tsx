"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import type { InvestmentPerformance } from "@/lib/logic";
import { CARDS_GROUP_FILTER, SEALED_GROUP_FILTER } from "@/lib/reference-data";
import type { SetDTO } from "@/lib/types";

// Décale les extensions sous leur groupe dans le menu (les <option> ignorent le padding).
const SET_OPTION_INDENT = "\u00a0\u00a0\u00a0";

function performanceOptions(t: Translator): { value: InvestmentPerformance; label: string }[] {
  return [
    { value: "all", label: t("investment.perfAll") },
    { value: "profit", label: t("investment.perfProfit") },
    { value: "loss", label: t("investment.perfLoss") },
    { value: "flat", label: t("investment.perfFlat") },
    { value: "unknown", label: t("investment.perfUnknown") },
    { value: "rising", label: t("investment.perfRising") },
    { value: "falling", label: t("investment.perfFalling") },
  ];
}

/** Filtres de la page : extension, langue, performance et recherche (repliés sur téléphone, sauf la recherche). */
export function InvestmentFilters({
  setFilter,
  setSetFilter,
  language,
  setLanguage,
  performance,
  setPerformance,
  query,
  setQuery,
  setOptions,
}: {
  setFilter: string;
  setSetFilter: (set: string) => void;
  language: string;
  setLanguage: (language: string) => void;
  performance: InvestmentPerformance;
  setPerformance: (performance: InvestmentPerformance) => void;
  query: string;
  setQuery: (query: string) => void;
  setOptions: { cardSets: SetDTO[]; sealedSets: SetDTO[] };
}) {
  const t = useTranslations();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const PERFORMANCE_OPTIONS = performanceOptions(t);
  const filtersId = useId();

  const activeFilterCount =
    (setFilter !== "all" ? 1 : 0) + (language ? 1 : 0) + (performance !== "all" ? 1 : 0);

  const renderSearch = () => (
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={t("investment.searchPlaceholder")}
      aria-label={t("investment.search")}
      type="search"
      enterKeyHint="search"
      className="h-10 w-full min-w-0 border border-line bg-background px-3 outline-none focus:border-cyan"
    />
  );

  return (
    <section className="flex flex-col gap-3 border border-line bg-panel p-3">
      {/* Mobile : recherche toujours visible, les autres filtres se déplient. */}
      <div className="flex gap-2 md:hidden">
        <div className="min-w-0 flex-1">{renderSearch()}</div>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen((open) => !open)}
          className={`flex h-10 shrink-0 items-center gap-2 border px-3 text-sm ${
            filtersOpen || activeFilterCount > 0 ? "border-cyan text-cyan" : "border-line text-muted"
          }`}
        >
          {t("filters.title")}
          {activeFilterCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center bg-cyan px-1 font-mono text-xs text-background">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>
      <div
        id={filtersId}
        className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-3 sm:grid-cols-3 md:grid md:grid-cols-4`}
      >
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t("investment.set")}</span>
          <select
            className="h-10 w-full min-w-0 border border-line bg-background px-3 outline-none focus:border-cyan"
            value={setFilter}
            onChange={(event) => setSetFilter(event.target.value)}
          >
            <option value="all">{t("investment.allSets")}</option>
            {setOptions.cardSets.length > 0 ? (
              <>
                <option value={CARDS_GROUP_FILTER} className="font-semibold">
                  {t("investment.groupCards")}
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
                  {t("investment.groupSealed")}
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
          <span className="mb-1 block text-muted">{t("investment.language")}</span>
          <select
            className="h-10 w-full min-w-0 border border-line bg-background px-3 outline-none focus:border-cyan"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">{t("investment.allLanguages")}</option>
            <option value="en">{t("common.english")}</option>
            <option value="fr">{t("common.french")}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t("investment.performance")}</span>
          <select
            className="h-10 w-full min-w-0 border border-line bg-background px-3 outline-none focus:border-cyan"
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
        <label className="hidden text-sm md:block">
          <span className="mb-1 block text-muted">{t("investment.search")}</span>
          {renderSearch()}
        </label>
      </div>
    </section>
  );
}
