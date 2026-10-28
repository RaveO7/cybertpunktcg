import { useTranslations } from "next-intl";
import { useNumberFormat, type NumberFormat } from "@/i18n/number-format";
import type { PriceMovement } from "@/lib/logic";

/** `percent` donné : affiche la variation en % au lieu du montant. */
export function TrendBadge({ delta, amount, percent }: { delta: PriceMovement; amount?: number | null; percent?: number | null }) {
  const t = useTranslations("common");
  const fmt = useNumberFormat();
  if (delta === "none" || delta === "flat") {
    return <span className="text-muted">—</span>;
  }
  const up = delta === "up";
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${up ? "text-gain" : "text-danger"}`}>
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      {percent != null ? (
        <span>{formatSignedPercent(fmt, percent)}</span>
      ) : amount == null ? null : (
        <span>{formatSignedMoney(fmt, amount)}</span>
      )}
      <span className="sr-only">{up ? t("trendUp") : t("trendDown")}</span>
    </span>
  );
}

export function formatSignedMoney(fmt: NumberFormat, amount: number, currency = "EUR") {
  const formatted = fmt.money(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

export function formatSignedPercent(fmt: NumberFormat, value: number) {
  const formatted = fmt.percent(Math.abs(value), 1);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}
