"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { extensionValue, sealedBrowseFilters } from "@/lib/logic";
import {
  ALL_SETS_ID,
  isSealedSetCode,
  isSetList,
  joinSetList,
  parseSetList,
  partitionCatalogSets,
} from "@/lib/reference-data";
import type { ConditionDTO, Facets, Filters } from "@/lib/types";

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

/**
 * Choix des extensions : menu à cases à cocher, plusieurs extensions à la fois. Aucune case cochée
 * (ou « Toutes les extensions ») revient à tout afficher. Échap ou un clic à l'extérieur referme.
 */
function SetMultiSelect({
  label,
  allLabel,
  countLabel,
  selected,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  countLabel: (count: number) => string;
  selected: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  const panelId = useId();
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const chosen = options.filter((option) => selected.includes(option.value));
  const summary = chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].label : countLabel(chosen.length);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggle = (value: string) => {
    const on = selected.includes(value);
    // Garde l'ordre des options pour une URL stable.
    const next = options.map((option) => option.value).filter((code) => (code === value ? !on : selected.includes(code)));
    onChange(next);
  };

  return (
    <div
      className="text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <span id={labelId} className="mb-1 block text-muted">
        {label}
      </span>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-labelledby={`${labelId} ${panelId}-value`}
          className={`${fieldClass} flex items-center gap-2 text-left`}
        >
          <span id={`${panelId}-value`} className="flex-1 truncate">
            {summary}
          </span>
          <svg
            viewBox="0 0 10 6"
            className={`h-1.5 w-2.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
        {open ? (
          <fieldset
            id={panelId}
            aria-labelledby={labelId}
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto border border-cyan/60 bg-[var(--hud-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          >
            <label className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 hover:bg-panel-2">
              <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
              <span className={selected.length === 0 ? "text-yellow" : ""}>{allLabel}</span>
            </label>
            {options.map((option) => {
              const on = selected.includes(option.value);
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-panel-2">
                  <input type="checkbox" checked={on} onChange={() => toggle(option.value)} />
                  <span className={on ? "text-yellow" : ""}>{option.label}</span>
                </label>
              );
            })}
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}

/** Bandes obliques qui découpent le cadre du symbole Nova Rare (x + y constant). */
const NOVA_GAPS = [4, 8, 12, 16, 20, 24, 28];

/**
 * Symbole de rareté imprimé en bas des cartes, redessiné en SVG (couleur du texte). Les trois Iconic partagent
 * le même symbole. Espace vide pour « Toutes » ou une rareté inconnue, afin de garder l'alignement.
 */
function RarityIcon({ rarity }: { rarity: string }) {
  const maskId = useId();
  const kind = rarity.startsWith("Iconic") ? "Iconic" : rarity;
  let shape: ReactNode = null;
  switch (kind) {
    case "Common":
      shape = <path d="M3 5.5 8 10.5 13 5.5" />;
      break;
    case "Uncommon":
      shape = <path d="M3 10.5 8 5.5 13 10.5" />;
      break;
    case "Rare":
      shape = <path d="M3.5 6.8 8 2.3 12.5 6.8M3.5 9.2 8 13.7 12.5 9.2" />;
      break;
    case "Epic":
      shape = (
        <>
          <path d="M3.5 6.8 8 2.3 12.5 6.8M3.5 9.2 8 13.7 12.5 9.2" />
          <path d="M8 6.6 9.4 8 8 9.4 6.6 8Z" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "Nova Rare":
      shape = (
        <>
          <mask id={maskId}>
            <rect width="16" height="16" fill="white" />
            {NOVA_GAPS.map((gap) => (
              <line key={gap} x1={gap} y1="0" x2={gap - 16} y2="16" stroke="black" strokeWidth="1.4" />
            ))}
          </mask>
          <rect x="3" y="3" width="10" height="10" strokeWidth="2.2" mask={`url(#${maskId})`} />
          <rect x="6.9" y="6.9" width="2.2" height="2.2" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "Secret":
      shape = (
        <>
          <path d="M5.2 3.6 1.8 8l3.4 4.4M10.8 3.6 14.2 8l-3.4 4.4" />
          <path d="M8 4.8 11.2 8 8 11.2 4.8 8Z" strokeWidth="1.3" />
          <path d="M8 7.1 8.9 8 8 8.9 7.1 8Z" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "Iconic":
      shape = (
        <>
          <path d="M2.2 7.2 5 4.4M2.2 8.8 5 11.6M13.8 7.2 11 4.4M13.8 8.8 11 11.6" />
          <path d="M8 1.8v2.8M8 14.2v-2.8" strokeWidth="2.2" />
          <path d="M5.2 7.3 8 4.5l2.8 2.8M5.2 8.7 8 11.5l2.8-2.8" />
          <path d="M8 7 9 8 8 9 7 8Z" fill="currentColor" stroke="none" />
        </>
      );
      break;
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      {shape}
    </svg>
  );
}

/**
 * Filtre de rareté : liste déroulante maison pour afficher la pastille de chaque rareté (la liste native
 * n'accepte que du texte). Flèches, Début/Fin, Entrée, Échap et première lettre au clavier.
 */
function RaritySelect({
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
  const listId = useId();
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const current = options[currentIndex];

  const openList = (index = currentIndex) => {
    setActive(index);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    close(true);
    if (options[index].value !== value) onChange(options[index].value);
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        setActive((index) => Math.min(last, index + 1));
        break;
      case "ArrowUp":
        setActive((index) => Math.max(0, index - 1));
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(last);
        break;
      case "Enter":
      case " ":
        choose(active);
        break;
      case "Escape":
        close(true);
        break;
      case "Tab":
        setOpen(false);
        return;
      default: {
        if (event.key.length !== 1) return;
        const letter = event.key.toLowerCase();
        const order = [...options.keys()].map((offset) => (active + 1 + offset) % options.length);
        const match = order.find((index) => options[index].label.toLowerCase().startsWith(letter));
        if (match === undefined) return;
        setActive(match);
      }
    }
    event.preventDefault();
  };

  return (
    <div className="text-sm">
      <span id={labelId} className="mb-1 block text-muted">
        {label}
      </span>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              openList();
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${listId}-value`}
          className={`${fieldClass} flex items-center gap-2 text-left`}
        >
          <RarityIcon rarity={current?.value ?? ""} />
          <span id={`${listId}-value`} className="flex-1 truncate">
            {current?.label}
          </span>
          <svg
            viewBox="0 0 10 6"
            className={`h-1.5 w-2.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
        {open ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKeyDown}
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto border border-cyan/60 bg-[var(--hud-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)] outline-none"
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              return (
                <li
                  key={option.value || "all"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={`relative flex cursor-pointer items-center gap-2 px-3 py-2 ${
                    index === active ? "bg-panel-2 text-foreground" : selected ? "text-yellow" : "text-muted"
                  }`}
                >
                  {index === active ? <span className="absolute inset-y-1 left-0 w-0.5 bg-cyan" aria-hidden="true" /> : null}
                  <RarityIcon rarity={option.value} />
                  <span className={`flex-1 ${selected ? "text-yellow" : ""}`}>{option.label}</span>
                  {selected ? (
                    <svg viewBox="0 0 12 10" className="h-2.5 w-3 text-yellow" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M1 5l3.5 3.5L11 1" />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
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
