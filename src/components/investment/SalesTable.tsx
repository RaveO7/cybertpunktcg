"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/i18n/config";
import { useNumberFormat } from "@/i18n/number-format";
import type { Translator } from "@/i18n/translator";
import { useIsDesktop } from "@/components/use-is-desktop";
import { ProfitValue, moneyOrDash, profitClass } from "@/components/investment/ui";
import type { SaleLine } from "@/lib/logic";

type SaleActions = {
  onEdit: (sale: SaleLine) => void;
  /** Annule la vente (les exemplaires reviennent dans la collection). */
  onUndo: (sale: SaleLine) => Promise<void>;
  openCard: (printingId: string) => void;
};

/** Ventes retenues par les filtres : date, carte, net perçu, prix de revient et plus-value réalisée. */
export function SalesTable({ lines, ...actions }: { lines: SaleLine[] } & SaleActions) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const isDesktop = useIsDesktop();
  // Annulation en deux temps : le premier clic demande confirmation sur la ligne.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function undo(sale: SaleLine) {
    if (confirming !== sale.saleId) {
      setConfirming(sale.saleId);
      return;
    }
    setBusy(sale.saleId);
    setError(null);
    try {
      await actions.onUndo(sale);
      setConfirming(null);
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : t("investment.sales.undoFailed"));
    } finally {
      setBusy(null);
    }
  }

  const rowProps = (sale: SaleLine) => ({
    sale,
    t,
    confirming: confirming === sale.saleId,
    busy: busy === sale.saleId,
    onEdit: () => actions.onEdit(sale),
    onUndo: () => void undo(sale),
    onOpenCard: () => actions.openCard(sale.printingId),
  });

  return (
    <section>
      <h2 className="mb-1 text-lg">{t("investment.sales.title")}</h2>
      <p className="mb-3 text-xs text-muted sm:text-sm">
        {t("investment.sales.hint", { count: fmt.int(lines.length), n: lines.length })}
      </p>
      {error ? (
        <p role="alert" className="mb-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {lines.length === 0 ? (
        <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t("investment.sales.empty")}</p>
      ) : isDesktop ? (
        <div className="scrollbar-hud overflow-x-auto overscroll-x-contain border border-line">
          <table className="w-full min-w-[46rem] text-left text-sm [&_td]:whitespace-nowrap">
            <thead className="bg-panel-2 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("investment.sales.date")}</th>
                <th className="px-3 py-2 font-medium">{t("investment.card")}</th>
                <th className="px-3 py-2 font-medium">{t("investment.qty")}</th>
                <th className="px-3 py-2 font-medium">{t("investment.sales.net")}</th>
                <th className="px-3 py-2 font-medium">{t("investment.sales.cost")}</th>
                <th className="px-3 py-2 font-medium">{t("investment.sales.realized")}</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">{t("investment.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((sale) => (
                <SaleRow key={sale.saleId} {...rowProps(sale)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="border border-line bg-panel">
          {lines.map((sale) => (
            <SaleItem key={sale.saleId} {...rowProps(sale)} />
          ))}
        </ul>
      )}
    </section>
  );
}

type RowProps = {
  sale: SaleLine;
  t: Translator;
  confirming: boolean;
  busy: boolean;
  onEdit: () => void;
  onUndo: () => void;
  onOpenCard: () => void;
};

function SaleRow({ sale, t, confirming, busy, onEdit, onUndo, onOpenCard }: RowProps) {
  const locale = useLocale();
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 font-mono text-xs">{formatSaleDay(sale.soldAt, locale)}</td>
      <td className="px-3 py-2 whitespace-normal">
        <CardName sale={sale} t={t} onOpenCard={onOpenCard} />
        <span className="block text-xs text-muted">
          {sale.setName} · #{sale.collectorNumber} · {sale.conditionCode}
        </span>
      </td>
      <td className="px-3 py-2 font-mono">×{sale.quantity}</td>
      <td className="px-3 py-2 font-mono">
        <NetValue sale={sale} t={t} />
      </td>
      <td className="px-3 py-2 font-mono">
        <CostValue sale={sale} t={t} />
      </td>
      <td className={`px-3 py-2 font-mono ${profitClass(sale.realized)}`}>
        <ProfitValue profit={sale.realized} basis={sale.costEur} />
      </td>
      <td className="px-3 py-2 text-right">
        <SaleButtons sale={sale} t={t} confirming={confirming} busy={busy} onEdit={onEdit} onUndo={onUndo} />
      </td>
    </tr>
  );
}

function SaleItem({ sale, t, confirming, busy, onEdit, onUndo, onOpenCard }: RowProps) {
  const locale = useLocale();
  return (
    <li className="border-t border-line px-3 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardName sale={sale} t={t} onOpenCard={onOpenCard} className="max-w-full truncate" />
          <p className="truncate text-xs text-muted">
            {formatSaleDay(sale.soldAt, locale)} · ×{sale.quantity} · {sale.conditionCode}
          </p>
          <p className="truncate text-xs text-muted">{sale.setName}</p>
        </div>
        <div className={`shrink-0 text-right font-mono ${profitClass(sale.realized)}`}>
          <ProfitValue profit={sale.realized} basis={sale.costEur} />
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
        <div className="min-w-0">
          <dt className="text-muted">{t("investment.sales.net")}</dt>
          <dd className="font-mono">
            <NetValue sale={sale} t={t} />
          </dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-muted">{t("investment.sales.cost")}</dt>
          <dd className="font-mono">
            <CostValue sale={sale} t={t} />
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex justify-end">
        <SaleButtons sale={sale} t={t} confirming={confirming} busy={busy} onEdit={onEdit} onUndo={onUndo} />
      </div>
    </li>
  );
}

function CardName({
  sale,
  t,
  onOpenCard,
  className = "",
}: {
  sale: SaleLine;
  t: Translator;
  onOpenCard: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={t("investment.openCard", { name: sale.title })}
      onClick={onOpenCard}
      className={`block text-left underline-offset-2 hover:text-cyan hover:underline ${className}`}
    >
      {sale.title}
    </button>
  );
}

/** Vente nette des frais (devise de la vente), avec les frais et l'équivalent en euros en dessous. */
function NetValue({ sale, t }: { sale: SaleLine; t: Translator }) {
  const fmt = useNumberFormat();
  return (
    <>
      {fmt.money(sale.salePrice - sale.fees, sale.saleCurrency)}
      {sale.saleCurrency !== "EUR" && sale.proceedsEur != null ? (
        <span className="block font-sans text-xs text-muted">{t("investment.approxEur", { amount: fmt.money(sale.proceedsEur) })}</span>
      ) : null}
      {sale.fees > 0 ? (
        <span className="block font-sans text-xs text-muted">
          {t("investment.sales.fees", { amount: fmt.money(sale.fees, sale.saleCurrency) })}
        </span>
      ) : null}
    </>
  );
}

/** Prix de revient des exemplaires vendus, en euros ; inconnu sans prix d'achat. */
function CostValue({ sale, t }: { sale: SaleLine; t: Translator }) {
  const fmt = useNumberFormat();
  if (sale.purchaseUnit == null) return <span className="font-sans text-xs text-muted">{t("investment.sales.unknownCost")}</span>;
  return (
    <>
      {moneyOrDash(fmt, sale.costEur)}
      {sale.purchaseCurrency && sale.purchaseCurrency !== "EUR" ? (
        <span className="block font-sans text-xs text-muted">
          {fmt.money(sale.purchaseUnit * sale.quantity, sale.purchaseCurrency)}
        </span>
      ) : null}
    </>
  );
}

function SaleButtons({
  sale,
  t,
  confirming,
  busy,
  onEdit,
  onUndo,
}: {
  sale: SaleLine;
  t: Translator;
  confirming: boolean;
  busy: boolean;
  onEdit: () => void;
  onUndo: () => void;
}) {
  return (
    <span className="inline-flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("investment.sales.editLabel", { name: sale.title })}
        className="h-8 border border-line px-2.5 text-xs text-muted hover:border-cyan hover:text-cyan"
      >
        {t("investment.sales.edit")}
      </button>
      <button
        type="button"
        onClick={onUndo}
        disabled={busy}
        aria-label={confirming ? undefined : t("investment.sales.undoLabel", { name: sale.title })}
        className={`h-8 border px-2.5 text-xs disabled:opacity-50 ${
          confirming ? "border-danger bg-danger/10 text-danger" : "border-line text-muted hover:border-danger hover:text-danger"
        }`}
      >
        {confirming ? t("investment.sales.undoConfirm") : t("investment.sales.undo")}
      </button>
    </span>
  );
}

/** Date de vente courte (« 12 mars 2026 »). */
function formatSaleDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}
