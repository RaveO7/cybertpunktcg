// Vue de la page Investissement dans l'URL : filtres, durée et tris survivent au rechargement.

import type { ChartRange } from "@/components/investment/chart-range";
import {
  LINE_SORT_KEYS,
  SET_SORT_KEYS,
  type LineSortKey,
  type SetSortKey,
  type SortState,
} from "@/components/investment/sorting";
import type { InvestmentPerformance } from "@/lib/logic";

export type InvestmentView = {
  set: string;
  language: string;
  performance: InvestmentPerformance;
  query: string;
  range: ChartRange;
  /** Tris choisis ; null = tri par défaut (absent de l'URL). */
  lineSort: SortState<LineSortKey> | null;
  setSort: SortState<SetSortKey> | null;
};

const RANGES: readonly ChartRange[] = ["1d", "1w", "1m", "1y", "all"];
const PERFORMANCES: readonly InvestmentPerformance[] = ["all", "profit", "loss", "flat", "unknown", "rising", "falling"];

type ParamsReader = { get(name: string): string | null };

function oneOf<T extends string>(values: readonly T[], raw: string | null, fallback: T): T {
  return raw != null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** « market-desc » → { key: "market", dir: "desc" } ; null si la colonne ou le sens est inconnu. */
function parseSort<K extends string>(keys: readonly K[], raw: string | null): SortState<K> | null {
  if (!raw) return null;
  const cut = raw.lastIndexOf("-");
  const key = raw.slice(0, cut);
  const dir = raw.slice(cut + 1);
  if (cut <= 0 || !(keys as readonly string[]).includes(key) || (dir !== "asc" && dir !== "desc")) return null;
  return { key: key as K, dir };
}

export function languageParam(value: string | null) {
  return value === "en" || value === "fr" ? value : "";
}

export function parseInvestmentView(params: ParamsReader): InvestmentView {
  return {
    set: params.get("set") || "all",
    language: languageParam(params.get("language")),
    performance: oneOf(PERFORMANCES, params.get("perf"), "all"),
    query: params.get("q") ?? "",
    range: oneOf(RANGES, params.get("range"), "all"),
    lineSort: parseSort(LINE_SORT_KEYS, params.get("sort")),
    setSort: parseSort(SET_SORT_KEYS, params.get("setSort")),
  };
}

/** Paramètres de la vue, valeurs par défaut omises (URL nue = vue par défaut). */
export function investmentViewParams(view: InvestmentView) {
  const params = new URLSearchParams();
  if (view.set !== "all") params.set("set", view.set);
  if (view.language) params.set("language", view.language);
  if (view.performance !== "all") params.set("perf", view.performance);
  if (view.query.trim()) params.set("q", view.query);
  if (view.range !== "all") params.set("range", view.range);
  if (view.lineSort) params.set("sort", `${view.lineSort.key}-${view.lineSort.dir}`);
  if (view.setSort) params.set("setSort", `${view.setSort.key}-${view.setSort.dir}`);
  return params;
}
