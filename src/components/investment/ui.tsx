"use client";

import type { ReactNode } from "react";
import { useNumberFormat, type NumberFormat } from "@/i18n/number-format";
import { TrendBadge, formatSignedMoney, formatSignedPercent } from "@/components/TrendBadge";
import { lineProfitPct } from "@/components/investment/sorting";
import { amountSign, type PriceMovement } from "@/lib/logic";

export function SummaryStat({
  label,
  value,
  delta,
  deltaAmount,
  tone,
  aside,
  detail,
}: {
  label: string;
  value: string;
  delta?: PriceMovement;
  deltaAmount?: number | null;
  tone?: "gain" | "loss";
  /** À côté de la valeur (ex. % de rendement). */
  aside?: ReactNode;
  /** Ligne d'explication sous la valeur. */
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 border border-line bg-panel px-3 py-3 sm:px-4">
      <p className="text-[11px] tracking-[0.12em] text-muted uppercase sm:text-xs sm:tracking-[0.14em]">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={`text-xl sm:text-2xl ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-danger" : "text-foreground"}`}>
          {value}
        </p>
        {delta && deltaAmount != null ? <TrendBadge delta={delta} amount={deltaAmount} /> : null}
        {aside}
      </div>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

export function MobileStat({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="truncate text-muted">{label}</dt>
      <dd className={`shrink-0 text-right font-mono ${className}`}>{children}</dd>
    </div>
  );
}

/** Filtre d'extension actif, retirable sur place. */
export function SetChip({ label, ariaLabel, onClear }: { label: string; ariaLabel: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={ariaLabel}
      className="flex h-8 max-w-full min-w-0 items-center gap-2 border border-cyan bg-cyan/10 px-2.5 text-sm text-cyan hover:bg-cyan/20"
    >
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden className="shrink-0 text-base leading-none">
        ×
      </span>
    </button>
  );
}

/** Variation du marché : % en principal, montant en dessous (rien si stable). Même rendu par extension et par carte. */
export function MarketChange({ delta, percent, amount }: { delta: PriceMovement; percent: number | null; amount: number | null }) {
  const fmt = useNumberFormat();
  const moving = delta === "up" || delta === "down";
  return (
    <>
      <TrendBadge delta={delta} percent={percent} />
      {moving && amount != null ? (
        <SubValue className={delta === "up" ? "text-gain" : "text-danger"}>{formatSignedMoney(fmt, amount)}</SubValue>
      ) : null}
    </>
  );
}

/**
 * P&L : % en principal, montant en dessous ; montant seul quand le % n'a pas de base (achat à 0 €).
 */
export function ProfitValue({ profit, basis }: { profit: number | null; basis: number | null }) {
  const fmt = useNumberFormat();
  if (profit == null) return "—";
  const pct = lineProfitPct({ profit, profitBasis: basis });
  const amount = formatSignedMoney(fmt, profit);
  if (pct == null) return amount;
  return (
    <>
      {formatSignedPercent(fmt, pct)}
      <SubValue>{amount}</SubValue>
    </>
  );
}

/** Valeur secondaire, en petit sous la valeur principale. */
export function SubValue({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`block font-mono text-xs opacity-80 ${className}`}>{children}</span>;
}

/** Montant, ou « — » quand il est inconnu. */
export function moneyOrDash(fmt: NumberFormat, amount: number | null, currency?: string | null) {
  return amount == null ? "—" : fmt.money(amount, currency || "EUR");
}

export function profitClass(value: number | null) {
  const sign = value == null ? 0 : amountSign(value);
  if (sign > 0) return "text-gain";
  if (sign < 0) return "text-danger";
  return "text-muted";
}
