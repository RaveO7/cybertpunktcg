import { useTranslations } from "next-intl";
import { useNumberFormat, type NumberFormat } from "@/i18n/number-format";
import type { PriceMovement } from "@/lib/logic";

export function TrendBadge({ delta, amount }: { delta: PriceMovement; amount?: number | null }) {
  const t = useTranslations("common");
  const fmt = useNumberFormat();
  if (delta === "none" || delta === "flat") {
    return <span className="text-muted">—</span>;
  }
  const up = delta === "up";
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${up ? "text-gain" : "text-danger"}`}>
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      {amount == null ? null : <span>{formatSignedMoney(fmt, amount)}</span>}
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
