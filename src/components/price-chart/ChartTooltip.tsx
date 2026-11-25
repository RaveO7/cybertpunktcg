import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { amountSign } from "@/lib/cards/pricing";
import { MAX_TOOLTIP_PURCHASES } from "./colors";
import { formatDay } from "./format";
import type { ChartPoint } from "./types";

type ChartTooltipProps = {
  active: ChartPoint;
  coord: { x: number; y: number };
  paddingTop: number;
  width: number;
  compact: boolean;
  localeTag: string;
};

/** Bulle au survol d'un point : valeur, investi, plus-value et achats du jour. */
export function ChartTooltip({ active, coord, paddingTop, width, compact, localeTag }: ChartTooltipProps) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const activePurchases = active.purchases ?? [];
  const detailedTooltip = active.invested != null || active.profit != null || activePurchases.length > 0;

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 border border-cyan/50 bg-black/95 px-2.5 py-1.5 whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
      style={{
        left: coord.x,
        // Bulle détaillée : posée en haut du tracé pour ne pas déborder sous le graphique.
        top: detailedTooltip ? paddingTop : Math.max(paddingTop, coord.y),
        transform: detailedTooltip
          ? coord.x > width * 0.62
            ? "translateX(calc(-100% - 14px))"
            : "translateX(14px)"
          : coord.x > width * 0.62
            ? "translate(calc(-100% - 14px), -50%)"
            : "translate(14px, -50%)",
      }}
    >
      <p className="font-mono text-[10px] tracking-wide text-cyan uppercase">{formatDay(active.day, localeTag, true)}</p>
      <p className={`font-mono leading-none text-yellow ${compact ? "mt-0.5 text-sm" : "mt-1 text-base"}`}>
        {fmt.money(active.value)}
      </p>
      {active.invested != null || active.profit != null ? (
        <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
          {active.invested != null ? (
            <>
              <dt className="text-muted">{t("chart.invested")}</dt>
              <dd className="text-right font-mono">{fmt.money(active.invested)}</dd>
            </>
          ) : null}
          {active.profit != null ? (
            <>
              <dt className="text-muted">{t("chart.profit")}</dt>
              <dd
                className={`text-right font-mono ${amountSign(active.profit) > 0 ? "text-gain" : amountSign(active.profit) < 0 ? "text-danger" : "text-muted"}`}
              >
                {active.profit > 0 ? "+" : active.profit < 0 ? "−" : ""}
                {fmt.money(Math.abs(active.profit))}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {activePurchases.length > 0 ? (
        <div className="mt-2 border-t border-line pt-1.5 text-xs">
          <p className="font-mono text-[10px] tracking-wide text-yellow uppercase">
            {t("chart.purchases", { n: activePurchases.length })}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {activePurchases.slice(0, MAX_TOOLTIP_PURCHASES).map((purchase, index) => (
              <li key={index} className="flex max-w-[16rem] items-baseline gap-2">
                <span className="shrink-0 font-mono text-muted">×{purchase.quantity}</span>
                <span className="min-w-0 truncate">{purchase.title}</span>
                <span className="ml-auto shrink-0 pl-2 font-mono">
                  {purchase.unitPrice == null ? "—" : fmt.money(purchase.unitPrice, purchase.currency || "EUR")}
                </span>
                {purchase.day !== active.day ? (
                  <span className="shrink-0 text-muted">{formatDay(purchase.day, localeTag)}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {activePurchases.length > MAX_TOOLTIP_PURCHASES ? (
            <p className="mt-0.5 text-muted">
              {t("chart.morePurchases", { n: activePurchases.length - MAX_TOOLTIP_PURCHASES })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
