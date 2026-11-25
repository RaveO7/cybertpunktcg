import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { amountSign } from "@/lib/cards/pricing";
import { formatPct } from "./format";

type ChartHeaderProps = {
  label: string;
  value: number;
  subtitle: string;
  delta: number;
  deltaPct: number | null;
  profitBased: boolean;
  periodLength: number;
  showPeriodLength: boolean;
  localeTag: string;
};

/** En-tête : valeur affichée, date ou période, et variation de la période. */
export function ChartHeader({
  label,
  value,
  subtitle,
  delta,
  deltaPct,
  profitBased,
  periodLength,
  showPeriodLength,
  localeTag,
}: ChartHeaderProps) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const trend = amountSign(delta) > 0 ? "up" : amountSign(delta) < 0 ? "down" : "flat";
  const deltaClass =
    trend === "up"
      ? "border-gain/40 bg-gain/10 text-gain"
      : trend === "down"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-line bg-panel-2 text-muted";

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.14em] text-cyan uppercase">{label}</p>
        <p className="mt-2.5 font-mono text-lg leading-none text-yellow">{fmt.money(value)}</p>
        <p className="mt-2.5 text-xs text-muted">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
        <span
          className={`inline-flex items-center gap-2 whitespace-nowrap border px-2.5 py-1.5 font-mono leading-none tabular-nums ${deltaClass}`}
        >
          <span aria-hidden className="text-[0.7em]">
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"}
          </span>
          <span>
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {fmt.money(Math.abs(delta))}
          </span>
          {deltaPct != null ? <span className="opacity-75">({formatPct(deltaPct, localeTag)})</span> : null}
        </span>
        {showPeriodLength ? (
          <span className="text-xs text-muted">
            {profitBased ? `${t("chart.periodProfit")} · ` : ""}
            {t("chart.days", { n: periodLength })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
