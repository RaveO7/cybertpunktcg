"use client";

import type { ReactNode } from "react";
import { TrendBadge } from "@/components/TrendBadge";
import type { PriceMovement } from "@/lib/logic";

export function SummaryStat({
  label,
  value,
  delta,
  deltaAmount,
  tone,
}: {
  label: string;
  value: string;
  delta?: PriceMovement;
  deltaAmount?: number | null;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="min-w-0 border border-line bg-panel px-3 py-3 sm:px-4">
      <p className="text-[11px] tracking-[0.12em] text-muted uppercase sm:text-xs sm:tracking-[0.14em]">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={`text-xl sm:text-2xl ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-danger" : "text-foreground"}`}>
          {value}
        </p>
        {delta && deltaAmount != null ? <TrendBadge delta={delta} amount={deltaAmount} /> : null}
      </div>
    </div>
  );
}

export function MobileStat({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="truncate text-muted">{label}</dt>
      <dd className={`shrink-0 font-mono ${className}`}>{children}</dd>
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

export function profitClass(value: number | null) {
  if (value == null) return "text-muted";
  if (value > 0.004) return "text-gain";
  if (value < -0.004) return "text-danger";
  return "text-muted";
}
