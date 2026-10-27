"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/i18n/config";
import { useNumberFormat } from "@/i18n/number-format";
import { Link, type Href } from "@/i18n/navigation";
import type { Translator } from "@/i18n/translator";
import { CardImage } from "@/components/CardImage";
import { TrendBadge, formatSignedMoney } from "@/components/TrendBadge";
import { MobileSort, SortableTh } from "@/components/investment/SortControls";
import {
  LINE_SORT_KEYS,
  lineMarketDelta,
  lineSortLabel,
  type LineSortKey,
  type SortState,
} from "@/components/investment/sorting";
import { profitClass } from "@/components/investment/ui";
import type { InvestmentLine } from "@/lib/logic";

/** Détail par exemplaire : liste sur téléphone, tableau triable sur ordinateur. */
export function LineTable({
  filtered,
  sortedLines,
  lineSort,
  effectiveLineSort,
  setLineSort,
  setChip,
}: {
  filtered: InvestmentLine[];
  sortedLines: InvestmentLine[];
  lineSort: SortState<LineSortKey> | null;
  effectiveLineSort: SortState<LineSortKey>;
  setLineSort: (sort: SortState<LineSortKey>) => void;
  setChip: ReactNode;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  return (

    <section>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-lg">{t("investment.detail")}</h2>
        {setChip}
      </div>
      <p className="mb-3 text-xs text-muted sm:text-sm">
        {t("investment.detailHint", { count: fmt.int(filtered.length), noun: t("common.lines", { n: filtered.length }) })}
      </p>
      {filtered.length === 0 ? (
        <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t("investment.noResults")}</p>
      ) : (
        <>
          <MobileSort
            options={LINE_SORT_KEYS.map((key) => ({ key, label: lineSortLabel(key, t) }))}
            sort={effectiveLineSort}
            onSort={setLineSort}
            t={t}
          />
          <ul className="border border-line bg-panel md:hidden">
            {sortedLines.map((line) => (
              <LineItem key={line.itemId} line={line} t={t} />
            ))}
          </ul>
          <div className="scrollbar-hud relative hidden overflow-x-auto overscroll-x-contain border border-line md:block">
            <table className="w-full min-w-[46rem] text-left text-sm [&_td]:whitespace-nowrap [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-panel [&_td:first-child]:whitespace-normal [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[2] [&_th:first-child]:bg-panel-2">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <SortableTh
                    label={t("investment.card")}
                    columnKey="card"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.set")}
                    columnKey="set"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.qty")}
                    columnKey="qty"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.purchase")}
                    columnKey="purchase"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.market")}
                    columnKey="market"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.marketVar")}
                    columnKey="marketVar"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                  <SortableTh
                    label={t("investment.purchasePnL")}
                    columnKey="purchasePnL"
                    sort={lineSort}
                    onSort={setLineSort}
                    t={t}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedLines.map((line) => (
                  <LineRow key={line.itemId} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function LineRow({ line }: { line: InvestmentLine }) {
  const fmt = useNumberFormat();
  const locale = useLocale();
  const href = lineHref(line);
  return (
    <tr className="border-t border-line hover:bg-white/5">
      <td className="p-0">
        <Link href={href} className="flex w-44 items-center gap-3 px-3 py-2 hover:text-cyan sm:w-auto sm:min-w-56">
          {line.imagePath ? (
            <CardImage src={line.imagePath} alt="" className="h-12 w-9 bg-black object-contain" loading="lazy" />
          ) : (
            <div className="grid h-12 w-9 place-items-center bg-black text-[10px] text-muted">N/A</div>
          )}
          <span>
            <span className="block font-mono text-xs text-muted">#{line.collectorNumber}</span>
            <span className="block">{line.title}</span>
            <span className="block text-xs text-muted">
              {line.conditionCode}
              {line.rarity ? ` · ${line.rarity}` : ""}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-muted">{line.setName}</td>
      <td className="px-3 py-2 font-mono">×{line.quantity}</td>
      <td className="px-3 py-2 font-mono">
        {line.purchaseTotal == null
          ? "—"
          : fmt.money(line.purchaseTotal, line.purchaseCurrency || "EUR")}
        {line.purchasedAt ? (
          <span className="block font-sans text-xs text-muted">{formatPurchaseDay(line.purchasedAt, locale)}</span>
        ) : null}
      </td>
      <td className="px-3 py-2 font-mono">{line.marketTotal == null ? "—" : fmt.money(line.marketTotal)}</td>
      <td className="px-3 py-2">
        <TrendBadge
          delta={line.marketDelta}
          amount={lineMarketDelta(line)}
        />
      </td>
      <td className={`px-3 py-2 font-mono ${profitClass(line.profit)}`}>
        {line.profit == null ? "—" : formatSignedMoney(fmt, line.profit)}
      </td>
    </tr>
  );
}

function LineItem({ line, t }: { line: InvestmentLine; t: Translator }) {
  const fmt = useNumberFormat();
  const locale = useLocale();
  return (
    <li className="border-t border-line first:border-t-0">
      <Link href={lineHref(line)} className="flex gap-3 px-3 py-3 hover:bg-white/5">
        {line.imagePath ? (
          <CardImage src={line.imagePath} alt="" className="h-16 w-12 shrink-0 bg-black object-contain" loading="lazy" />
        ) : (
          <div className="grid h-16 w-12 shrink-0 place-items-center bg-black text-[10px] text-muted">N/A</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate">{line.title}</p>
              <p className="truncate text-xs text-muted">
                #{line.collectorNumber} · {line.conditionCode}
                {line.rarity ? ` · ${line.rarity}` : ""}
              </p>
              <p className="truncate text-xs text-muted">{line.setName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono">{line.marketTotal == null ? "—" : fmt.money(line.marketTotal)}</p>
              <p className="text-xs">
                <TrendBadge delta={line.marketDelta} amount={lineMarketDelta(line)} />
              </p>
            </div>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-x-3 text-xs">
            <div className="min-w-0">
              <dt className="text-muted">{t("investment.qty")}</dt>
              <dd className="font-mono">×{line.quantity}</dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-muted">{t("investment.purchase")}</dt>
              <dd className="truncate font-mono">
                {line.purchaseTotal == null ? "—" : fmt.money(line.purchaseTotal, line.purchaseCurrency || "EUR")}
              </dd>
              {line.purchasedAt ? (
                <dd className="truncate text-muted">{formatPurchaseDay(line.purchasedAt, locale)}</dd>
              ) : null}
            </div>
            <div className="min-w-0 text-right">
              <dt className="truncate text-muted">{t("investment.purchasePnL")}</dt>
              <dd className={`truncate font-mono ${profitClass(line.profit)}`}>
                {line.profit == null ? "—" : formatSignedMoney(fmt, line.profit)}
              </dd>
            </div>
          </dl>
        </div>
      </Link>
    </li>
  );
}

/** Date d'achat courte (« 12 mars 2026 »). */
function formatPurchaseDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}

function lineHref(line: InvestmentLine): Href {
  return { pathname: "/cards", query: { set: line.setCode, language: line.language, printing: line.printingId } };
}
