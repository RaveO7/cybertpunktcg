"use client";

import { useMemo, useState } from "react";
import { extensionValue, sealedBrowseFilters } from "@/lib/logic";
import { ALL_SETS_ID, isSealedSetCode, partitionCatalogSets } from "@/lib/reference-data";
import type { ConditionDTO, Facets, Filters } from "@/lib/types";
import { useI18n } from "@/components/LocaleProvider";

const fieldClass =
  "h-10 w-full border border-line bg-panel-2 px-3 text-sm outline-none focus:border-cyan";

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
  const { t } = useI18n();
  const languageLabels: Record<string, string> = {
    en: t.common.english,
    fr: t.common.french,
    de: t.common.german,
    es: t.common.spanish,
    it: t.common.italian,
  };
  const collectionHelp: Record<Filters["collection"], string> = {
    all: t.filters.helpAll,
    owned: t.filters.helpOwned,
    missing: t.filters.helpMissing,
    duplicates: t.filters.helpDuplicates,
    extras: t.filters.helpExtras,
  };

  const { cardSets, sealedSets } = useMemo(
    () => partitionCatalogSets(sets.map((set) => ({ ...set, sortOrder: set.sortOrder ?? 0 }))),
    [sets],
  );
  const isSealed = isSealedSetCode(filters.set);
  const setOptions = isSealed ? sealedSets : cardSets;
  const resetLabel = t.filters.reset || t.common.reset;

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-medium leading-none">{t.filters.title}</h2>
        {onClose ? (
          <button type="button" aria-label={t.filters.close} className="grid h-10 w-10 place-items-center text-cyan" onClick={onClose}>
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
        label={t.filters.language}
        value={filters.language}
        onChange={(language) => onChange({ language, page: 1 })}
        options={[
          ...(filters.set === ALL_SETS_ID ? [{ value: "", label: t.common.all }] : []),
          ...facets.languages.map((language) => ({
            value: language,
            label: languageLabels[language] ?? language,
          })),
        ]}
      />


      <Select
        label={isSealed ? t.filters.sealedSet : t.filters.set}
        value={isSealed ? filters.set : extensionValue(filters.set)}
        onChange={(set) =>
          onChange(isSealedSetCode(set) ? sealedBrowseFilters(set, { language: filters.language }) : { set, page: 1 })
        }
        options={
          isSealed
            ? sealedSets.map((set) => ({ value: set.code, label: set.name }))
            : [
                { value: ALL_SETS_ID, label: t.filters.allSets },
                ...setOptions.map((set) => ({
                  value: set.code,
                  label: set.status === "upcoming" ? t.filters.setUpcoming(set.name) : set.name,
                })),
              ]
        }
      />
      {!isSealed ? (
        <>
          <Select
            label={t.filters.rarity}
            value={filters.rarity}
            onChange={(rarity) => onChange({ rarity, page: 1 })}
            options={[{ value: "", label: t.common.all }, ...facets.rarities.map((rarity) => ({ value: rarity, label: rarity }))]}
          />
          <TagList
            label={t.filters.artist}
            options={facets.artists}
            selected={filters.artists}
            onChange={(artists) => onChange({ artists, page: 1 })}
            filterPlaceholder={t.filters.filterList}
          />
          <Chips label={t.filters.color} options={facets.colors} selected={filters.colors} onChange={(colors) => onChange({ colors, page: 1 })} />
          <Chips label={t.filters.type} options={facets.types} selected={filters.types} onChange={(types) => onChange({ types, page: 1 })} />
          <TagList
            label={t.filters.tags}
            options={facets.tags}
            selected={filters.tags}
            onChange={(tags) => onChange({ tags, page: 1 })}
            filterPlaceholder={t.filters.filterList}
          />
          {facets.keywords.length > 0 ? (
            <TagList
              label={t.filters.keyword}
              options={facets.keywords}
              selected={filters.keywords}
              onChange={(keywords) => onChange({ keywords, page: 1 })}
              filterPlaceholder={t.filters.filterList}
            />
          ) : null}
          <Chips label={t.filters.cost} options={facets.costs} selected={filters.costs} onChange={(costs) => onChange({ costs, page: 1 })} />
          <Chips label={t.filters.power} options={facets.powers} selected={filters.powers} onChange={(powers) => onChange({ powers, page: 1 })} />
          <Chips label={t.filters.ram} options={facets.rams} selected={filters.rams} onChange={(rams) => onChange({ rams, page: 1 })} />
          {facets.eddiable ? (
            <Select
              label={t.filters.eddies}
              value={filters.eddiable}
              onChange={(eddiable) => onChange({ eddiable: eddiable as Filters["eddiable"], page: 1 })}
              options={[
                { value: "", label: t.common.allMasculine },
                { value: "true", label: t.filters.sellable },
                { value: "false", label: t.filters.notSellable },
              ]}
            />
          ) : null}
        </>
      ) : null}
      <div>
        <Select
          label={t.filters.collection}
          value={filters.collection}
          onChange={(collection) => onChange({ collection: collection as Filters["collection"], page: 1 })}
          options={[
            { value: "all", label: isSealed ? t.filters.allSealed : t.filters.allCards },
            { value: "owned", label: t.filters.owned },
            { value: "missing", label: t.filters.missing },
            { value: "duplicates", label: t.filters.duplicates },
            { value: "extras", label: t.filters.extras },
          ]}
        />
        <p className="mt-1 text-xs text-muted">{collectionHelp[filters.collection]}</p>
      </div>
      <Select
        label={t.filters.condition}
        value={filters.condition}
        onChange={(condition) => onChange({ condition, page: 1 })}
        options={[
          { value: "", label: t.common.allMasculine },
          ...conditions.map((condition) => ({ value: condition.code, label: `${condition.code} — ${condition.name}` })),
        ]}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chips({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option || "empty"}
              type="button"
              className={`border px-2 py-1 text-xs ${on ? "border-yellow bg-yellow/10 text-yellow" : "border-line text-muted"}`}
              onClick={() => onChange(on ? selected.filter((value) => value !== option) : [...selected, option])}
            >
              {option || "—"}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function TagList({
  label,
  options,
  selected,
  onChange,
  filterPlaceholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  filterPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  if (options.length === 0) return null;
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? options.filter((option) => option.toLowerCase().includes(normalized))
    : options;
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={filterPlaceholder}
        className={`${fieldClass} mb-2`}
      />
      <div className="max-h-40 space-y-1 overflow-y-auto border border-line bg-panel p-2">
        {visible.map((option) => {
          const on = selected.includes(option);
          return (
            <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? selected.filter((value) => value !== option) : [...selected, option])}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
