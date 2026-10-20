"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { Link, type Href } from "@/i18n/navigation";
import { formatSignedMoney } from "@/components/TrendBadge";

export function ProfitText({ value }: { value: number | null }) {
  const fmt = useNumberFormat();
  if (value == null) return <span className="text-muted">—</span>;
  const tone = value > 0.004 ? "text-gain" : value < -0.004 ? "text-danger" : "text-muted";
  return <span className={`font-mono ${tone}`}>{formatSignedMoney(fmt, value)}</span>;
}

export function Bar({
  percent,
  tone = "cyan",
  color,
  thick = false,
}: {
  percent: number;
  tone?: "cyan" | "yellow";
  color?: string;
  thick?: boolean;
}) {
  return (
    <span className={`block flex-1 bg-panel-2 ${thick ? "h-1.5" : "h-1"}`}>
      <span
        className={`block h-full transition-[width] duration-500 ${color ? "" : tone === "yellow" ? "bg-yellow" : "bg-cyan"}`}
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: color,
        }}
      />
    </span>
  );
}

export function GlobalStat({
  label,
  href,
  linkLabel,
  tone,
  last = false,
  children,
}: {
  label: string;
  href?: Href;
  linkLabel?: string;
  tone?: "danger";
  last?: boolean;
  children: ReactNode;
}) {
  // Grille 2×2 (téléphone, tablette) puis 4 colonnes : bordures entre les cases seulement.
  const className = `flex min-w-0 flex-col gap-1.5 border-line/60 px-4 py-3.5 odd:border-r [&:nth-child(-n+2)]:border-b sm:px-7 sm:py-4 xl:[&:nth-child(-n+2)]:border-b-0 ${
    last ? "" : "xl:border-r"
  } ${href ? "hover:bg-panel-2/40" : ""}`;
  const body = (
    <>
      <span className="flex flex-wrap justify-between gap-x-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px] sm:tracking-[0.16em]">
        <span>{label}</span>
        {href && linkLabel ? (
          <span className={tone === "danger" ? "text-danger" : "text-cyan"}>{linkLabel} →</span>
        ) : null}
      </span>
      <span className="flex flex-wrap items-baseline gap-2.5">{children}</span>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export function MiniStat({
  label,
  value,
  href,
  tone,
  last = false,
}: {
  label: string;
  value: string;
  href?: Href;
  tone?: "danger";
  last?: boolean;
}) {
  const className = `flex flex-col gap-1 px-4 py-4 sm:px-5 ${last ? "" : "border-r border-line/60"} ${
    href ? "hover:bg-panel-2/40" : ""
  }`;
  const body = (
    <>
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className={`font-mono text-xl ${tone === "danger" ? "text-danger" : "text-foreground"}`}>{value}</span>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export function SegmentGroup({
  children,
  ariaLabel,
  grow = false,
}: {
  children: ReactNode;
  ariaLabel: string;
  grow?: boolean;
}) {
  return (
    <div className={`flex border border-line ${grow ? "flex-1" : ""}`} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`min-h-11 flex-1 px-4 text-sm font-medium transition-colors ${
        active ? "bg-yellow text-black" : "text-muted hover:text-foreground"
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[88px] shrink-0 sm:size-[104px]" aria-hidden>
      <svg viewBox="0 0 104 104" className="size-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--yellow)"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base text-yellow sm:text-lg">{label}</span>
      </span>
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">{title}</h2>
          {hint ? <p className="text-sm text-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyPanel({ children }: { children: ReactNode }) {
  return <p className="hud-panel px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

/** Sur mobile la largeur minimale est ignorée : le tableau tient dans l'écran au lieu de défiler. */
export function DataTable({ minWidth, className = "", children }: { minWidth: string; className?: string; children: ReactNode }) {
  return (
    <div className={`hud-panel relative overflow-x-auto scrollbar-hud ${className}`}>
      <table
        className="w-full text-left text-sm md:min-w-[var(--table-min)] [&_tbody_tr]:border-t [&_tbody_tr]:border-line/60 [&_tbody_tr:first-child]:border-t-0 [&_tbody_tr:hover]:bg-cyan/[0.04] [&_thead]:border-b [&_thead]:border-[var(--hud-border)] [&_th]:px-2.5 [&_th]:py-3 [&_th]:font-display [&_th]:text-[10px] sm:[&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.04em] [&_th]:text-muted sm:[&_th]:whitespace-nowrap sm:[&_th]:px-4 sm:[&_th]:tracking-[0.12em]"
        style={{ "--table-min": minWidth } as CSSProperties}
      >
        {children}
      </table>
    </div>
  );
}

export function EmptyCatalog() {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="hud-panel p-8">
        <h1 className="text-2xl text-yellow">{t("dashboard.emptyTitle")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {t("dashboard.emptyBody")} <code className="text-cyan">npm run import:cards</code>.
        </p>
      </div>
    </div>
  );
}
