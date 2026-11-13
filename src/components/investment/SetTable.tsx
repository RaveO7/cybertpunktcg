"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat, type NumberFormat } from "@/i18n/number-format";
import type { Translator } from "@/i18n/translator";
import { MobileColumnHints, MobileSort, SortableTh } from "@/components/investment/SortControls";
import {
  SET_SORT_KEYS,
  SET_TABLE_KEYS,
  setMarketDeltaPct,
  setSortLabel,
  type SetSortKey,
  type SortState,
} from "@/components/investment/sorting";
import { MarketChange, MobileStat, ProfitValue, profitClass } from "@/components/investment/ui";
import { useIsDesktop } from "@/components/use-is-desktop";
import type { SetInvestment } from "@/lib/logic";
import { CARDS_GROUP_FILTER, SEALED_GROUP_FILTER } from "@/lib/reference-data";

/**
 * Valeur par extension : liste sur téléphone, tableau triable sur ordinateur (une seule des deux
 * est rendue) ; une ligne sert de filtre.
 */
export function SetTable({
  bySet,
  sortedCardSets,
  sortedSealedSets,
  setFilter,
  toggleSet,
  effectiveSetSort,
  setSetSort,
  setChip,
}: {
  bySet: SetInvestment[];
  sortedCardSets: SetInvestment[];
  sortedSealedSets: SetInvestment[];
  setFilter: string;
  toggleSet: (code: string) => void;
  /** Tri appliqué, celui par défaut compris : la colonne triée est toujours signalée. */
  effectiveSetSort: SortState<SetSortKey>;
  setSetSort: (sort: SortState<SetSortKey>) => void;
  setChip: ReactNode;
}) {
  const t = useTranslations();
  const isDesktop = useIsDesktop();
  const columns = SET_SORT_KEYS.map((key) => ({ key, label: setSortLabel(key, t) }));
  const entries = setEntries(sortedCardSets, sortedSealedSets, setFilter, t);
  return (

    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg">{t("investment.bySet")}</h2>
        {setChip}
      </div>
      {bySet.length === 0 ? (
        <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t("investment.emptyFiltered")}</p>
      ) : !isDesktop ? (
        <>
          <MobileSort options={columns} sort={effectiveSetSort} onSort={setSetSort} t={t} />
          <MobileColumnHints columns={columns} t={t} />
          <ul className="border border-line bg-panel">
            {entries.map((entry) =>
              entry.row ? (
                <SetItem key={entry.code} row={entry.row} t={t} active={setFilter === entry.code} onOpen={() => toggleSet(entry.code)} />
              ) : (
                <GroupItem
                  key={entry.code}
                  label={entry.label}
                  active={setFilter === entry.code}
                  onSelect={() => toggleSet(entry.code)}
                />
              ),
            )}
          </ul>
        </>
      ) : (
        <>
          <div className="scrollbar-hud relative overflow-x-auto overscroll-x-contain border border-line">
            <table className="w-full min-w-[40rem] text-left text-sm [&_td]:whitespace-nowrap [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-panel [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[2] [&_th:first-child]:bg-panel-2">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  {SET_TABLE_KEYS.map((key) => (
                    <SortableTh
                      key={key}
                      label={setSortLabel(key, t)}
                      columnKey={key}
                      sort={effectiveSetSort}
                      onSort={setSetSort}
                      t={t}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) =>
                  entry.row ? (
                    <SetRow key={entry.code} row={entry.row} active={setFilter === entry.code} onOpen={() => toggleSet(entry.code)} />
                  ) : (
                    <GroupRow
                      key={entry.code}
                      label={entry.label}
                      active={setFilter === entry.code}
                      onSelect={() => toggleSet(entry.code)}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Ligne de la liste : un groupe (« Cartes », « Scellé ») ou une extension ; chacun sert de filtre (`code`). */
type SetEntry = { code: string; label: string; row: SetInvestment | null };

/**
 * Lignes dans l'ordre d'affichage : les extensions de cartes, puis les produits scellés sous leur groupe.
 * Le groupe « Cartes » n'apparaît que s'il y a aussi du scellé (ou s'il est le filtre choisi).
 */
function setEntries(cardSets: SetInvestment[], sealedSets: SetInvestment[], setFilter: string, t: Translator): SetEntry[] {
  const entries: SetEntry[] = [];
  const asEntry = (row: SetInvestment): SetEntry => ({ code: row.setCode, label: row.setName, row });
  if (cardSets.length > 0 && (sealedSets.length > 0 || setFilter === CARDS_GROUP_FILTER)) {
    entries.push({ code: CARDS_GROUP_FILTER, label: t("investment.groupCards"), row: null });
  }
  entries.push(...cardSets.map(asEntry));
  if (sealedSets.length > 0) entries.push({ code: SEALED_GROUP_FILTER, label: t("investment.groupSealed"), row: null });
  entries.push(...sealedSets.map(asEntry));
  return entries;
}

/** Chiffres d'une extension, les mêmes dans le tableau et dans la liste. */
function setFigures(row: SetInvestment, fmt: NumberFormat) {
  return {
    copies: `${fmt.int(row.pricedCopies)} / ${fmt.int(row.copies)}`,
    market: row.pricedCopies > 0 ? fmt.money(row.marketTotal) : "—",
    marketVar: <MarketChange delta={row.marketDelta} percent={setMarketDeltaPct(row)} amount={row.marketDeltaAmount} />,
    invested: row.investedLines > 0 ? fmt.money(row.investedEur) : "—",
    profit: <ProfitValue profit={row.profitEur} basis={row.profitBasis} />,
    profitClass: profitClass(row.profitEur),
  };
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
  const figures = setFigures(row, useNumberFormat());
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
      <td className="px-3 py-2 font-mono">{figures.copies}</td>
      <td className="px-3 py-2 font-mono">{figures.market}</td>
      <td className="px-3 py-2">{figures.marketVar}</td>
      <td className="px-3 py-2 font-mono">{figures.invested}</td>
      <td className={`px-3 py-2 font-mono ${figures.profitClass}`}>{figures.profit}</td>
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
  const figures = setFigures(row, useNumberFormat());
  return (
    <li className={`border-t border-line first:border-t-0 ${active ? "bg-cyan/10" : ""}`}>
      <button type="button" aria-pressed={active} className="block w-full px-3 py-3 text-left hover:bg-white/5" onClick={onOpen}>
        <span className="flex items-baseline justify-between gap-3">
          <span className={`min-w-0 truncate ${active ? "text-cyan" : ""}`}>{row.setName}</span>
          <span className="shrink-0 font-mono">{figures.market}</span>
        </span>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <MobileStat label={t("investment.copies")}>{figures.copies}</MobileStat>
          <MobileStat label={t("investment.marketVar")}>{figures.marketVar}</MobileStat>
          <MobileStat label={t("investment.investedCol")}>{figures.invested}</MobileStat>
          <MobileStat label={t("investment.purchasePnL")} className={figures.profitClass}>
            {figures.profit}
          </MobileStat>
        </dl>
      </button>
    </li>
  );
}
