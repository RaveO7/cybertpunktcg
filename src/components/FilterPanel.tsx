"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { extensionValue } from "@/lib/cards/printings";
import { sealedBrowseFilters } from "@/lib/cards/filters";
import {
  ALL_SETS_ID,
  isSealedSetCode,
  isSetList,
  joinSetList,
  parseSetList,
  partitionCatalogSets,
} from "@/lib/reference-data";
import type { ConditionDTO, Facets, Filters } from "@/lib/types";
import { Chips } from "./filter-panel/Chips";
import { RaritySelect } from "./filter-panel/RaritySelect";
import { Select } from "./filter-panel/Select";
import { SetMultiSelect } from "./filter-panel/SetMultiSelect";
import { TagList } from "./filter-panel/TagList";

export function FilterPanel({
  filters,
  facets,
  sets,
  conditions,
  onChange,
  onReset,
  onClose,
}: {
  filters: Filters;
  facets: Facets;
  sets: { code: string; name: string; status?: string; sortOrder?: number }[];
  conditions: ConditionDTO[];
  onChange: (partial: Partial<Filters>) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  const t = useTranslations();
  const languageLabels: Record<string, string> = {
    en: t("common.english"),
    fr: t("common.french"),
    de: t("common.german"),
    es: t("common.spanish"),
    it: t("common.italian"),
  };
  const collectionHelp: Record<Filters["collection"], string> = {
    all: t("filters.helpAll"),
    owned: t("filters.helpOwned"),
    missing: t("filters.helpMissing"),
    duplicates: t("filters.helpDuplicates"),
  };

  const { cardSets, sealedSets } = useMemo(
    () => partitionCatalogSets(sets.map((set) => ({ ...set, sortOrder: set.sortOrder ?? 0 }))),
    [sets],
  );
  const isSealed = isSealedSetCode(filters.set);
  const resetLabel = t("filters.reset") || t("common.reset");

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-medium leading-none">{t("filters.title")}</h2>
        {onClose ? (
          <button type="button" aria-label={t("filters.close")} className="grid h-10 w-10 place-items-center text-cyan" onClick={onClose}>
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M12 4 6 10l6 6" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
          </button>
        ) : null}
      </div>

      <button
        type="button"
        className="h-10 w-full shrink-0 border border-cyan text-sm text-cyan hover:bg-cyan/10"
        onClick={onReset}
      >
        {resetLabel}
      </button>

      <Select
        label={t("filters.language")}
        value={filters.language}
        onChange={(language) => onChange({ language, page: 1 })}
        options={[
          ...(filters.set === ALL_SETS_ID || isSetList(filters.set) ? [{ value: "", label: t("common.all") }] : []),
          ...facets.languages.map((language) => ({
            value: language,
            label: languageLabels[language] ?? language,
          })),
        ]}
      />


      {isSealed ? (
        <Select
          label={t("filters.sealedSet")}
          value={filters.set}
          onChange={(set) => onChange(sealedBrowseFilters(set, { language: filters.language }))}
          options={sealedSets.map((set) => ({ value: set.code, label: set.name }))}
        />
      ) : (
        <SetMultiSelect
          label={t("filters.set")}
          allLabel={t("filters.allSets")}
          countLabel={(count) => t("filters.setsSelected", { count })}
          selected={filters.set === ALL_SETS_ID ? [] : parseSetList(filters.set).map(extensionValue)}
          onChange={(codes) => onChange({ set: joinSetList(codes), page: 1 })}
          options={cardSets.map((set) => ({
            value: set.code,
            label: set.status === "upcoming" ? t("filters.setUpcoming", { name: set.name }) : set.name,
          }))}
        />
      )}
      {!isSealed ? (
        <>
          <RaritySelect
            label={t("filters.rarity")}
            value={filters.rarity}
            onChange={(rarity) => onChange({ rarity, page: 1 })}
            options={[{ value: "", label: t("common.all") }, ...facets.rarities.map((rarity) => ({ value: rarity, label: rarity }))]}
          />
          <TagList
            label={t("filters.artist")}
            options={facets.artists}
            selected={filters.artists}
            onChange={(artists) => onChange({ artists, page: 1 })}
            filterPlaceholder={t("filters.filterList")}
          />
          <Chips label={t("filters.color")} options={facets.colors} selected={filters.colors} onChange={(colors) => onChange({ colors, page: 1 })} />
          <Chips label={t("filters.type")} options={facets.types} selected={filters.types} onChange={(types) => onChange({ types, page: 1 })} />
          <TagList
            label={t("filters.tags")}
            options={facets.tags}
            selected={filters.tags}
            onChange={(tags) => onChange({ tags, page: 1 })}
            filterPlaceholder={t("filters.filterList")}
          />
          {facets.keywords.length > 0 ? (
            <TagList
              label={t("filters.keyword")}
              options={facets.keywords}
              selected={filters.keywords}
              onChange={(keywords) => onChange({ keywords, page: 1 })}
              filterPlaceholder={t("filters.filterList")}
            />
          ) : null}
          <Chips label={t("filters.cost")} options={facets.costs} selected={filters.costs} onChange={(costs) => onChange({ costs, page: 1 })} />
          <Chips label={t("filters.power")} options={facets.powers} selected={filters.powers} onChange={(powers) => onChange({ powers, page: 1 })} />
          <Chips label={t("filters.ram")} options={facets.rams} selected={filters.rams} onChange={(rams) => onChange({ rams, page: 1 })} />
          {facets.eddiable ? (
            <Select
              label={t("filters.eddies")}
              value={filters.eddiable}
              onChange={(eddiable) => onChange({ eddiable: eddiable as Filters["eddiable"], page: 1 })}
              options={[
                { value: "", label: t("common.allMasculine") },
                { value: "true", label: t("filters.sellable") },
                { value: "false", label: t("filters.notSellable") },
              ]}
            />
          ) : null}
        </>
      ) : null}
      <div>
        <Select
          label={t("filters.collection")}
          value={filters.collection}
          onChange={(collection) => onChange({ collection: collection as Filters["collection"], page: 1 })}
          options={[
            { value: "all", label: isSealed ? t("filters.allSealed") : t("filters.allCards") },
            { value: "owned", label: t("filters.owned") },
            { value: "missing", label: t("filters.missing") },
            { value: "duplicates", label: t("filters.duplicates") },
          ]}
        />
        <p className="mt-1 text-xs text-muted">{collectionHelp[filters.collection]}</p>
      </div>
      <Select
        label={t("filters.condition")}
        value={filters.condition}
        onChange={(condition) => onChange({ condition, page: 1 })}
        options={[
          { value: "", label: t("common.allMasculine") },
          ...conditions.map((condition) => ({ value: condition.code, label: `${condition.code} — ${condition.name}` })),
        ]}
      />
    </div>
  );
}
