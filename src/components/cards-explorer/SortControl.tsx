"use client";

import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import type { Filters } from "@/lib/types";

type SortDirection = "asc" | "desc";

/** Critère de tri affiché dans le menu ; le sens se choisit avec la flèche à côté. */
type SortField = {
  id: string;
  label: string;
  /** Clé de tri par sens ; une seule entrée quand le critère n'a pas de sens. */
  keys: { asc: Filters["sort"]; desc?: Filters["sort"] };
};

function sortFields(t: Translator): SortField[] {
  return [
    { id: "default", label: t("cards.sortDefault"), keys: { asc: "default" } },
    { id: "number", label: t("cards.sortFieldNumber"), keys: { asc: "number-asc", desc: "number-desc" } },
    { id: "price", label: t("cards.sortFieldPrice"), keys: { asc: "price-asc", desc: "price-desc" } },
    { id: "play-cost", label: t("filters.cost"), keys: { asc: "play-cost-asc", desc: "play-cost-desc" } },
    { id: "power", label: t("filters.power"), keys: { asc: "power-asc", desc: "power-desc" } },
    { id: "ram", label: t("filters.ram"), keys: { asc: "ram-asc", desc: "ram-desc" } },
    { id: "qty", label: t("cards.sortFieldQty"), keys: { asc: "qty-asc", desc: "qty-desc" } },
    { id: "name", label: t("cards.sortFieldName"), keys: { asc: "name-asc", desc: "name-desc" } },
    { id: "owned", label: t("cards.sortFieldOwned"), keys: { asc: "missing-first", desc: "owned-first" } },
    { id: "rarity", label: t("cards.sortRarity"), keys: { asc: "rarity" } },
    { id: "set", label: t("cards.groupSet"), keys: { asc: "set" } },
  ];
}

function splitSort(fields: SortField[], sort: Filters["sort"]): { field: SortField; dir: SortDirection } {
  for (const field of fields) {
    if (field.keys.asc === sort) return { field, dir: "asc" };
    if (field.keys.desc === sort) return { field, dir: "desc" };
  }
  return { field: fields[0], dir: "asc" };
}

/** Menu du critère de tri et bouton du sens (croissant / décroissant). */
export function SortControl({ sort, onChange }: { sort: Filters["sort"]; onChange: (sort: Filters["sort"]) => void }) {
  const t = useTranslations();
  const fields = sortFields(t);
  const { field, dir } = splitSort(fields, sort);
  const directional = field.keys.desc !== undefined;
  return (
    <div className="flex h-10 min-w-0 flex-1 sm:flex-none">
      <select
        aria-label={t("cards.sort")}
        className="h-10 min-w-0 flex-1 border border-line-field bg-panel px-3 text-sm"
        value={field.id}
        onChange={(event) => {
          const next = fields.find((item) => item.id === event.target.value) ?? fields[0];
          onChange((dir === "desc" && next.keys.desc) || next.keys.asc);
        }}
      >
        {fields.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!directional}
        aria-label={`${t("cards.sortToggleDirection")} (${dir === "asc" ? t("cards.sortAscending") : t("cards.sortDescending")})`}
        title={dir === "asc" ? t("cards.sortAscending") : t("cards.sortDescending")}
        className="grid h-10 w-10 shrink-0 place-items-center border border-l-0 border-line bg-panel text-cyan disabled:text-muted disabled:opacity-40"
        onClick={() => {
          if (!field.keys.desc) return;
          onChange(dir === "asc" ? field.keys.desc : field.keys.asc);
        }}
      >
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M10 16V4M5 9l5-5 5 5" strokeLinecap="square" />
        </svg>
      </button>
    </div>
  );
}
