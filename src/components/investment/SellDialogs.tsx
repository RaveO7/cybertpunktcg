"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/i18n/config";
import { useNumberFormat } from "@/i18n/number-format";
import { usePreferences } from "@/components/PreferencesProvider";
import { todayInputValue } from "@/components/card-modal/shared";
import { ProfitValue, moneyOrDash, profitClass } from "@/components/investment/ui";
import type { SaleInput } from "@/components/investment/use-investment-ledger";
import { useModal } from "@/components/use-modal";
import { toEur, type ExchangeRates, type InvestmentLine, type InvestmentPosition, type SaleLine } from "@/lib/logic";
import { CURRENCIES } from "@/lib/parse";
import type { SellAlertDTO } from "@/lib/types";

const fieldClass = "h-11 w-full min-w-0 border border-line bg-panel-2 px-3 text-base outline-none focus:border-cyan";
const labelClass = "mb-1.5 block text-sm font-semibold";

/** Montant saisi (« 12,50 » ou « 12.5 ») ; null si vide ou invalide. */
function parseAmount(text: string) {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Fenêtre de saisie : voile, feuille du bas sur téléphone, boîte centrée sur ordinateur. */
function DialogShell({
  title,
  busy,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  // Focus sur la fenêtre elle-même : un champ focalisé ouvrirait le clavier du téléphone.
  useModal(overlayRef, { onClose, initialFocus: formRef, closeOnEscape: !busy });
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        ref={formRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        className="pb-safe scrollbar-hud max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain border-t border-yellow/60 bg-panel px-4 pt-4 pb-4 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] outline-none sm:border"
      >
        <h2 id={titleId} className="mb-4 text-lg font-bold text-white">
          {title}
        </h2>
        {children}
      </form>
    </div>
  );
}

function DialogActions({
  busy,
  disabled,
  submitLabel,
  cancelLabel,
  onCancel,
  extra,
}: {
  busy: boolean;
  disabled: boolean;
  submitLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {extra}
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="h-11 border border-line px-4 text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={busy || disabled}
        className="h-11 bg-yellow px-4 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function formatDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}

/** Vente à saisir : un achat d'une carte du détail, ou une vente existante à corriger. */
export type SellTarget = { kind: "sell"; position: InvestmentPosition; itemId: string } | { kind: "edit"; sale: SaleLine };

/**
 * Vente d'exemplaires d'un achat (quantité, prix de vente total, frais, date), ou correction d'une vente.
 * L'aperçu montre le net perçu, le prix de revient et la plus-value réalisée en euros.
 */
export function SellDialog({
  target,
  rates,
  pendingIds,
  onSell,
  onUpdate,
  onClose,
}: {
  target: SellTarget;
  rates: ExchangeRates;
  /** Lignes visées par une modification hors ligne en attente : pas de vente tant qu'elle n'est pas envoyée. */
  pendingIds: ReadonlySet<string>;
  onSell: (itemId: string, quantity: number, input: SaleInput) => Promise<void>;
  onUpdate: (saleId: string, input: SaleInput) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const locale = useLocale();
  const { prefs } = usePreferences();
  const sale = target.kind === "edit" ? target.sale : null;
  const position = target.kind === "sell" ? target.position : null;
  const [itemId, setItemId] = useState(target.kind === "sell" ? target.itemId : "");
  const line: InvestmentLine | null = position
    ? (position.lines.find((entry) => entry.itemId === itemId) ?? position.lines[0])
    : null;
  const [quantity, setQuantity] = useState(sale ? String(sale.quantity) : "1");
  const [price, setPrice] = useState(sale ? sale.salePrice.toFixed(2) : "");
  const [currency, setCurrency] = useState<string>(sale?.saleCurrency ?? prefs.currency);
  const [fees, setFees] = useState(sale && sale.fees > 0 ? sale.fees.toFixed(2) : "");
  const [date, setDate] = useState(sale?.soldAt ?? todayInputValue());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = line?.quantity ?? sale?.quantity ?? 1;
  const parsedQuantity = Number(quantity);
  const validQuantity = Number.isInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= max;
  const salePrice = parseAmount(price);
  const saleFees = fees.trim() === "" ? 0 : parseAmount(fees);
  const pending = line != null && pendingIds.has(line.itemId);
  const valid = validQuantity && salePrice != null && saleFees != null && date !== "" && !pending;

  // Aperçu en euros : vente nette au taux du jour de la vente, prix de revient des exemplaires vendus.
  const net = salePrice != null && saleFees != null ? salePrice - saleFees : null;
  const netEur = net == null ? null : toEur(net, currency, date, rates);
  const costEur = sale
    ? sale.costEur
    : line?.costEur != null && validQuantity
      ? (line.costEur * parsedQuantity) / line.quantity
      : null;
  const realized = netEur != null && costEur != null ? netEur - costEur : null;
  const name = position?.title ?? sale?.title ?? "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy || salePrice == null || saleFees == null) return;
    setBusy(true);
    setError(null);
    const input: SaleInput = { salePrice: salePrice.toFixed(2), saleCurrency: currency, fees: saleFees.toFixed(2), soldAt: date };
    try {
      if (sale) await onUpdate(sale.saleId, input);
      else if (line) await onSell(line.itemId, parsedQuantity, input);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("investment.sell.failed"));
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title={sale ? t("investment.sell.editTitle", { name }) : t("investment.sell.title", { name })}
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
    >
      {position && position.lines.length > 1 ? (
        <label className="mb-3 block">
          <span className={labelClass}>{t("investment.sell.line")}</span>
          <select
            value={line?.itemId ?? ""}
            onChange={(event) => {
              setItemId(event.target.value);
              setQuantity("1");
            }}
            className={fieldClass}
          >
            {position.lines.map((entry) => (
              <option key={entry.itemId} value={entry.itemId}>
                {[
                  entry.purchasedAt ? formatDay(entry.purchasedAt, locale) : t("investment.noPurchaseDate"),
                  entry.conditionCode,
                  `×${entry.quantity}`,
                  entry.purchaseTotal == null ? null : fmt.money(entry.purchaseTotal, entry.purchaseCurrency || "EUR"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0">
          <span className={labelClass}>{t("investment.sell.quantity")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            value={quantity}
            disabled={sale != null}
            onChange={(event) => setQuantity(event.target.value)}
            className={`${fieldClass} font-mono disabled:opacity-60`}
          />
          {line ? <span className="mt-1 block text-xs text-muted">{t("investment.sell.available", { n: line.quantity })}</span> : null}
        </label>
        <label className="min-w-0">
          <span className={labelClass}>{t("investment.sell.date")}</span>
          <input
            type="date"
            required
            value={date}
            min={line?.purchasedAt ?? sale?.purchasedAt ?? undefined}
            max={todayInputValue()}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="min-w-0">
          <span className={labelClass}>{t("investment.sell.price")}</span>
          <span className="flex h-11 border border-line bg-panel-2 focus-within:border-cyan">
            <input
              inputMode="decimal"
              required
              placeholder={line?.marketUnit != null && validQuantity ? (line.marketUnit * parsedQuantity).toFixed(2) : "—"}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 font-mono text-base outline-none"
            />
            <select
              aria-label={t("modal.currency")}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="shrink-0 border-l border-line bg-panel px-2 font-mono text-sm outline-none"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="min-w-0">
          <span className={labelClass}>{t("investment.sell.fees")}</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={fees}
            onChange={(event) => setFees(event.target.value)}
            className={`${fieldClass} font-mono`}
          />
        </label>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border border-line bg-panel-2/60 px-3 py-2 text-xs">
        <div className="min-w-0">
          <dt className="text-muted">{t("investment.sell.net")}</dt>
          <dd className="truncate font-mono text-sm">
            {moneyOrDash(fmt, net, currency)}
            {net != null && currency !== "EUR" && netEur != null ? (
              <span className="block text-xs text-muted">{t("investment.approxEur", { amount: fmt.money(netEur) })}</span>
            ) : null}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">{t("investment.sell.cost")}</dt>
          <dd className="truncate font-mono text-sm">{moneyOrDash(fmt, costEur)}</dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-muted">{t("investment.realized")}</dt>
          <dd className={`truncate font-mono text-sm ${profitClass(realized)}`}>
            <ProfitValue profit={realized} basis={costEur} />
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-muted">{t("investment.sell.help")}</p>
      {pending ? <p className="mt-2 text-sm text-yellow">{t("investment.sell.pending")}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <DialogActions
        busy={busy}
        disabled={!valid}
        submitLabel={sale ? t("investment.sell.save") : t("investment.sell.submit")}
        cancelLabel={t("investment.sell.cancel")}
        onCancel={onClose}
      />
    </DialogShell>
  );
}

const PRESET_PERCENTS = [10, 25, 50];

/**
 * Alerte de revente d'une carte : prix visé en euros, avec des raccourcis au-dessus du PRU (prix moyen
 * payé) ou, sans prix d'achat, au-dessus du prix actuel.
 */
export function SellAlertDialog({
  position,
  alert,
  onSave,
  onRemove,
  onClose,
}: {
  position: InvestmentPosition;
  alert: SellAlertDTO | null;
  onSave: (printingId: string, targetPrice: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const [target, setTarget] = useState(alert?.targetPrice ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = parseAmount(target);
  const valid = amount != null && amount > 0;
  // PRU en euros : prix de revient des exemplaires qui en ont un.
  const unitCost = position.costEur != null && position.profitQuantity > 0 ? position.costEur / position.profitQuantity : null;
  const base = unitCost ?? position.marketUnit;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("investment.alert.failed"));
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title={t("investment.alert.title", { name: position.title })}
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) void run(() => onSave(position.printingId, amount.toFixed(2)));
      }}
    >
      <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{t("investment.alert.current", { price: moneyOrDash(fmt, position.marketUnit) })}</span>
        {unitCost != null ? <span>{t("investment.alert.cost", { price: fmt.money(unitCost) })}</span> : null}
      </p>
      <label className="block">
        <span className={labelClass}>{t("investment.alert.target")}</span>
        <input
          inputMode="decimal"
          required
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className={`${fieldClass} font-mono`}
        />
      </label>
      {base != null && base > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_PERCENTS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setTarget((base * (1 + pct / 100)).toFixed(2))}
              className="h-9 border border-line px-3 font-mono text-xs text-muted hover:border-cyan hover:text-cyan"
            >
              {unitCost != null ? t("investment.alert.presetCost", { pct }) : t("investment.alert.presetMarket", { pct })}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-muted">{t("investment.alert.help")}</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <DialogActions
        busy={busy}
        disabled={!valid}
        submitLabel={t("investment.alert.save")}
        cancelLabel={t("investment.sell.cancel")}
        onCancel={onClose}
        extra={
          alert ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onRemove(alert.id))}
              className="mr-auto h-11 px-2 text-sm text-danger hover:underline disabled:opacity-50"
            >
              {t("investment.alert.remove")}
            </button>
          ) : null
        }
      />
    </DialogShell>
  );
}
