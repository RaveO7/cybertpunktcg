import { CONDITIONS } from "@/lib/reference-data";
import type { CollectionFilter, SortKey } from "@/lib/types";
import { CURRENCIES, type CurrencyCode } from "@/lib/parse";

export const PREFERENCES_STORAGE_KEY = "cptcg-preferences";

export type FiltersPanelMode = "auto" | "open" | "closed";
export type ThemeMode = "dark" | "light";

export type UserPreferences = {
  theme: ThemeMode;
  currency: CurrencyCode;
  condition: string;
  sort: SortKey;
  collection: CollectionFilter;
  filtersPanel: FiltersPanelMode;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  currency: "EUR",
  condition: "NM",
  sort: "number-asc",
  collection: "all",
  filtersPanel: "auto",
};

const CONDITION_CODES = new Set<string>(CONDITIONS.map((entry) => entry.code));
const SORT_KEYS = new Set<SortKey>([
  "default",
  "number-asc",
  "number-desc",
  "cost-asc",
  "cost-desc",
  "qty-asc",
  "qty-desc",
  "name-asc",
  "name-desc",
  "rarity",
  "set",
  "owned-first",
  "missing-first",
]);
const COLLECTION_FILTERS = new Set<CollectionFilter>(["all", "owned", "missing", "duplicates"]);
const PANEL_MODES = new Set<FiltersPanelMode>(["auto", "open", "closed"]);
const THEME_MODES = new Set<ThemeMode>(["dark", "light"]);

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

export function normalizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const value = raw as Record<string, unknown>;
  return {
    theme:
      typeof value.theme === "string" && THEME_MODES.has(value.theme as ThemeMode)
        ? (value.theme as ThemeMode)
        : DEFAULT_PREFERENCES.theme,
    currency: isCurrency(value.currency) ? value.currency : DEFAULT_PREFERENCES.currency,
    condition:
      typeof value.condition === "string" && CONDITION_CODES.has(value.condition)
        ? value.condition
        : DEFAULT_PREFERENCES.condition,
    sort:
      typeof value.sort === "string" && SORT_KEYS.has(value.sort as SortKey)
        ? (value.sort as SortKey)
        : DEFAULT_PREFERENCES.sort,
    collection:
      typeof value.collection === "string" && COLLECTION_FILTERS.has(value.collection as CollectionFilter)
        ? (value.collection as CollectionFilter)
        : DEFAULT_PREFERENCES.collection,
    filtersPanel:
      typeof value.filtersPanel === "string" && PANEL_MODES.has(value.filtersPanel as FiltersPanelMode)
        ? (value.filtersPanel as FiltersPanelMode)
        : DEFAULT_PREFERENCES.filtersPanel,
  };
}

export function readStoredPreferences(): UserPreferences {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    return normalizePreferences(JSON.parse(stored) as unknown);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writeStoredPreferences(prefs: UserPreferences) {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

export function filterDefaultsFrom(prefs: UserPreferences): Pick<UserPreferences, "sort" | "collection"> {
  return { sort: prefs.sort, collection: prefs.collection };
}
