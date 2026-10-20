"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { TrendBadge } from "@/components/TrendBadge";
import { sortScopes, type Block, type Extension, type Scope, type SortKey } from "@/components/dashboard/model";
import { Bar, EmptyPanel, Section } from "@/components/dashboard/ui";

/** Grille des blocs (ou des catégories scellées), triable ; inutile s'il n'y a qu'un bloc. */
export function BlockGrid({
  isSealed,
  gridItems,
  current,
  sort,
  hasPrices,
  setSort,
  selectItem,
}: {
  isSealed: boolean;
  gridItems: (Block | Extension)[];
  current: Scope | null;
  sort: SortKey;
  hasPrices: boolean;
  setSort: (sort: SortKey) => void;
  selectItem: (entry: Block | Extension) => void;
}) {
  const t = useTranslations();
  if (!isSealed && gridItems.length === 1) return null;
  return (

    <Section
      title={isSealed ? t("dashboard.sealedCategories") : t("dashboard.blocks")}
      hint={isSealed ? t("dashboard.sealedGridHint") : undefined}
      action={
        gridItems.length > 1 ? (
          <div role="group" aria-label={t("dashboard.sortGroup")} className="flex items-center border border-line">
            <span className="px-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:px-3">
              {t("dashboard.sortLabel")}
            </span>
            {(
              [
                ["catalog", t("dashboard.sortCatalog")],
                ["progress", t("dashboard.progress")],
                ["value", t("dashboard.value")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={sort === id}
                onClick={() => setSort(id)}
                className={`min-h-10 border-l border-line px-2.5 text-sm sm:px-3.5 ${
                  sort === id ? "bg-panel-2 text-yellow" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {gridItems.length === 0 ? (
        <EmptyPanel>{isSealed ? t("dashboard.emptySealed") : t("dashboard.emptyInvestment")}</EmptyPanel>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]">
          {sortScopes(gridItems, sort).map((entry) => (
            <GridCard
              key={entry.key}
              item={entry}
              selected={entry.key === current?.key}
              hasPrices={hasPrices}
              onSelect={() => selectItem(entry)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function GridCard({
  item,
  selected,
  hasPrices,
  onSelect,
}: {
  item: Scope;
  selected: boolean;
  hasPrices: boolean;
  onSelect: () => void;
}) {
  const fmt = useNumberFormat();
  const { progress, value } = item;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex flex-col gap-3.5 rounded-xl border p-5 text-left transition-colors ${
        selected
          ? "border-yellow bg-panel-2 shadow-[inset_0_0_0_1px_var(--yellow)]"
          : "border-[var(--hud-border)] bg-[var(--hud-panel)] shadow-[inset_0_0_0_1px_var(--hud-inset)] hover:border-cyan/60"
      }`}
    >
      <span className="font-display text-[17px] font-semibold uppercase leading-snug tracking-wide text-foreground">
        {item.name}
      </span>
      <span className="flex flex-col gap-2">
        <Bar percent={progress.percent} tone={selected ? "yellow" : "cyan"} />
        <span className="flex justify-between font-mono text-sm text-muted">
          <span>
            <span className="text-foreground">{fmt.int(progress.uniqueOwned)}</span> / {fmt.int(progress.total)}
          </span>
          <span>{fmt.percent(progress.percent)}</span>
        </span>
      </span>
      <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-line/60 pt-3">
        <span className="font-mono text-base text-foreground">
          {hasPrices && value && value.pricedCopies > 0 ? fmt.money(value.marketTotal) : "—"}
        </span>
        {value ? <TrendBadge delta={value.marketDelta} amount={value.marketDeltaAmount} /> : null}
      </span>
    </button>
  );
}
