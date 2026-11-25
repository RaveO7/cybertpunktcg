"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { usePreferences } from "@/components/PreferencesProvider";
import { CURRENCIES } from "@/lib/parse";
import { CONDITIONS } from "@/lib/reference-data";
import type { FiltersPanelMode, UserPreferences } from "@/lib/preferences";
import type { CollectionFilter, SortKey } from "@/lib/types";
import { SettingsField } from "./SettingsField";
import { sortOptions } from "./sort-options";

export function DefaultsSection() {
  const t = useTranslations();
  const { prefs, setPrefs, resetPrefs } = usePreferences();
  const sorts = useMemo(() => sortOptions(t), [t]);

  const collectionOptions: { value: CollectionFilter; label: string }[] = [
    { value: "all", label: t("filters.allCards") },
    { value: "owned", label: t("filters.owned") },
    { value: "missing", label: t("filters.missing") },
    { value: "duplicates", label: t("filters.duplicates") },
  ];

  const panelOptions: { value: FiltersPanelMode; label: string }[] = [
    { value: "auto", label: t("settings.filtersPanelAuto") },
    { value: "open", label: t("settings.filtersPanelOpen") },
    { value: "closed", label: t("settings.filtersPanelClosed") },
  ];

  function patchPref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs({ [key]: value });
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.collectionDefaults")}</h2>
      <p className="mt-2 text-sm text-muted">{t("settings.collectionDefaultsHint")}</p>

      <div className="mt-4 space-y-4">
        <SettingsField
          label={t("settings.defaultCurrency")}
          hint={t("settings.defaultCurrencyHint")}
          value={prefs.currency}
          onChange={(value) => patchPref("currency", value as UserPreferences["currency"])}
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
        />
        <SettingsField
          label={t("settings.defaultCondition")}
          hint={t("settings.defaultConditionHint")}
          value={prefs.condition}
          onChange={(value) => patchPref("condition", value)}
          options={CONDITIONS.map((condition) => ({
            value: condition.code,
            label: `${condition.code} — ${condition.name}`,
          }))}
        />
        <SettingsField
          label={t("settings.defaultSort")}
          hint={t("settings.defaultSortHint")}
          value={prefs.sort}
          onChange={(value) => patchPref("sort", value as SortKey)}
          options={sorts}
        />
        <SettingsField
          label={t("settings.defaultCollection")}
          hint={t("settings.defaultCollectionHint")}
          value={prefs.collection}
          onChange={(value) => patchPref("collection", value as CollectionFilter)}
          options={collectionOptions}
        />
        <SettingsField
          label={t("settings.filtersPanel")}
          hint={t("settings.filtersPanelHint")}
          value={prefs.filtersPanel}
          onChange={(value) => patchPref("filtersPanel", value as FiltersPanelMode)}
          options={panelOptions}
        />
      </div>

      <button
        type="button"
        onClick={() => resetPrefs()}
        className="mt-4 h-10 w-full border border-line text-sm text-muted hover:border-cyan hover:text-cyan"
      >
        {t("settings.resetDefaults")}
      </button>
    </section>
  );
}
