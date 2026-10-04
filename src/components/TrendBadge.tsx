import type { PriceMovement } from "@/lib/logic";
import { formatMoney } from "@/lib/logic";

export function TrendBadge({ delta, amount }: { delta: PriceMovement; amount?: number | null }) {
  if (delta === "none" || delta === "flat") {
    return <span className="text-muted">—</span>;
  }
  const up = delta === "up";
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${up ? "text-gain" : "text-danger"}`}>
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      {amount == null ? null : <span>{formatSignedMoney(amount)}</span>}
      <span className="sr-only">{up ? "en hausse" : "en baisse"}</span>
    </span>
  );
}

export function formatSignedMoney(amount: number, currency = "EUR") {
  const formatted = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}
