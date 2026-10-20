"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import type { Translator } from "@/i18n/translator";
import { TrendBadge, formatSignedMoney } from "@/components/TrendBadge";
import { MobileSort, SortableTh } from "@/components/investment/SortControls";
import { SET_SORT_KEYS, setSortLabel, type SetSortKey, type SortState } from "@/components/investment/sorting";
import { MobileStat, profitClass } from "@/components/investment/ui";
import type { SetInvestment } from "@/lib/logic";
import { CARDS_GROUP_FILTER, SEALED_GROUP_FILTER } from "@/lib/reference-data";

/** Valeur par extension : liste sur téléphone, tableau triable sur ordinateur ; une ligne sert de filtre. */
export function SetTable({
  bySet,
  sortedCardSets,
  sortedSealedSets,
  setFilter,
  toggleSet,
  setSort,
  effectiveSetSort,
  setSetSort,
  setChip,
}: {
  bySet: SetInvestment[];
  sortedCardSets: SetInvestment[];
  sortedSealedSets: SetInvestment[];
  setFilter: string;
  toggleSet: (code: string) => void;
  setSort: SortState<SetSortKey> | null;
  effectiveSetSort: SortState<SetSortKey>;
  setSetSort: (sort: SortState<SetSortKey>) => void;
  setChip: ReactNode;
}) {
  const t = useTranslations();
  return (

    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg">{t("investment.bySet")}</h2>
        {setChip}
      </div>
      {bySet.length === 0 ? (
        <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t("investment.emptyFiltered")}</p>
      ) : (
        <>
          <MobileSort
            options={SET_SORT_KEYS.map((key) => ({ key, label: setSortLabel(key, t) }))}
            sort={effectiveSetSort}
            onSort={setSetSort}
            t={t}
          />
          <ul className="border border-line bg-panel md:hidden">
            {sortedCardSets.length > 0 && (sortedSealedSets.length > 0 || setFilter === CARDS_GROUP_FILTER) ? (
              <GroupItem
                label={t("investment.groupCards")}
                active={setFilter === CARDS_GROUP_FILTER}
                onSelect={() => toggleSet(CARDS_GROUP_FILTER)}
              />
            ) : null}
            {sortedCardSets.map((row) => (
              <SetItem key={row.setCode} row={row} t={t} active={setFilter === row.setCode} onOpen={() => toggleSet(row.setCode)} />
            ))}
            {sortedSealedSets.length > 0 ? (
              <GroupItem
                label={t("investment.groupSealed")}
                active={setFilter === SEALED_GROUP_FILTER}
                onSelect={() => toggleSet(SEALED_GROUP_FILTER)}
              />
            ) : null}
            {sortedSealedSets.map((row) => (
              <SetItem key={row.setCode} row={row} t={t} active={setFilter === row.setCode} onOpen={() => toggleSet(row.setCode)} />
            ))}
          </ul>
          <div className="scrollbar-hud relative hidden overflow-x-auto overscroll-x-contain border border-line md:block">
            <table className="w-full min-w-[40rem] text-left text-sm [&_td]:whitespace-nowrap [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-panel [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[2] [&_th:first-child]:bg-panel-2">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <SortableTh
                    label={t("investment.set")}
                    columnKey="set"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.copies")}
                    columnKey="copies"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.marketValue")}
                    columnKey="marketValue"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.marketVar")}
                    columnKey="marketVar"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.investedCol")}
                    columnKey="invested"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.purchasePnL")}
                    columnKey="purchasePnL"
                    sort={setSort}
                    onSort={setSetSort}
                    t={t}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedCardSets.length > 0 && (sortedSealedSets.length > 0 || setFilter === CARDS_GROUP_FILTER) ? (
                  <GroupRow
                    label={t("investment.groupCards")}
                    active={setFilter === CARDS_GROUP_FILTER}
                    onSelect={() => toggleSet(CARDS_GROUP_FILTER)}
                  />
                ) : null}
                {sortedCardSets.map((row) => (
                  <SetRow key={row.setCode} row={row} active={setFilter === row.setCode} onOpen={() => toggleSet(row.setCode)} />
                ))}
                {sortedSealedSets.length > 0 ? (
                  <GroupRow
                    label={t("investment.groupSealed")}
                    active={setFilter === SEALED_GROUP_FILTER}
                    onSelect={() => toggleSet(SEALED_GROUP_FILTER)}
                  />
                ) : null}
                {sortedSealedSets.map((row) => (
                  <SetRow key={row.setCode} row={row} active={setFilter === row.setCode} onOpen={() => toggleSet(row.setCode)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function GroupRow({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <tr className={`border-t border-line ${active ? "bg-cyan/10" : "bg-panel-2/60"}`}>
      <td colSpan={6} className="static! bg-transparent! p-0">
        <button
          type="button"
          aria-pressed={active}
          className={`block w-full px-3 py-2 text-left text-xs tracking-wide hover:text-cyan ${
            active ? "text-cyan" : "text-muted"
          }`}
          onClick={onSelect}
        >
          {label}
        </button>
      </td>
    </tr>
  );
}

function SetRow({ row, active, onOpen }: { row: SetInvestment; active: boolean; onOpen: () => void }) {
  const fmt = useNumberFormat();
  return (
    <tr className={`border-t border-line ${active ? "bg-cyan/10" : "hover:bg-white/5"}`}>
      <td className="p-0">
        <button
          type="button"
          aria-pressed={active}
          className={`block w-full px-3 py-2 text-left hover:text-cyan ${active ? "text-cyan" : ""}`}
          onClick={onOpen}
        >
          {row.setName}
        </button>
      </td>
      <td className="px-3 py-2 font-mono">
        {fmt.int(row.pricedCopies)} / {fmt.int(row.copies)}
      </td>
      <td className="px-3 py-2 font-mono">{row.pricedCopies > 0 ? fmt.money(row.marketTotal) : "—"}</td>
      <td className="px-3 py-2">
        <TrendBadge delta={row.marketDelta} amount={row.marketDeltaAmount} />
      </td>
      <td className="px-3 py-2 font-mono">{row.investedLines > 0 ? fmt.money(row.investedEur) : "—"}</td>
      <td className={`px-3 py-2 font-mono ${profitClass(row.profitEur)}`}>
        {row.profitEur == null ? "—" : formatSignedMoney(fmt, row.profitEur)}
      </td>
    </tr>
  );
}

function GroupItem({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <li className={`border-t border-line first:border-t-0 ${active ? "bg-cyan/10" : "bg-panel-2/60"}`}>
      <button
        type="button"
        aria-pressed={active}
        className={`block w-full px-3 py-2 text-left text-xs tracking-wide hover:text-cyan ${active ? "text-cyan" : "text-muted"}`}
        onClick={onSelect}
      >
        {label}
      </button>
    </li>
  );
}

function SetItem({ row, t, active, onOpen }: { row: SetInvestment; t: Translator; active: boolean; onOpen: () => void }) {
  const fmt = useNumberFormat();
  return (
    <li className={`border-t border-line first:border-t-0 ${active ? "bg-cyan/10" : ""}`}>
      <button type="button" aria-pressed={active} className="block w-full px-3 py-3 text-left hover:bg-white/5" onClick={onOpen}>
        <span className="flex items-baseline justify-between gap-3">
          <span className={`min-w-0 truncate ${active ? "text-cyan" : ""}`}>{row.setName}</span>
          <span className="shrink-0 font-mono">{row.pricedCopies > 0 ? fmt.money(row.marketTotal) : "—"}</span>
        </span>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <MobileStat label={t("investment.copies")}>
            {fmt.int(row.pricedCopies)} / {fmt.int(row.copies)}
          </MobileStat>
          <MobileStat label={t("investment.marketVar")}>
            <TrendBadge delta={row.marketDelta} amount={row.marketDeltaAmount} />
          </MobileStat>
          <MobileStat label={t("investment.investedCol")}>
            {row.investedLines > 0 ? fmt.money(row.investedEur) : "—"}
          </MobileStat>
          <MobileStat label={t("investment.purchasePnL")} className={profitClass(row.profitEur)}>
            {row.profitEur == null ? "—" : formatSignedMoney(fmt, row.profitEur)}
          </MobileStat>
        </dl>
      </button>
    </li>
  );
}
