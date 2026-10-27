"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat, type NumberFormat } from "@/i18n/number-format";
import { PriceChart, type ChartPoint } from "@/components/PriceChart";
import { TrendBadge, formatSignedMoney } from "@/components/TrendBadge";
import { fieldLabelClass, toAmount } from "@/components/card-modal/shared";
import { priceMovement } from "@/lib/logic";
import type { CollectionItemDTO, PrintingDTO } from "@/lib/types";

function formatSignedPercent(fmt: NumberFormat, value: number) {
  const formatted = fmt.percent(Math.abs(value), 1);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

/**
 * Prix de la fiche : prix tendance, variation, historique et gain / perte sur les exemplaires achetés.
 * Chargé à la demande par la fiche (graphique compris).
 */
export function PricePanel({
  printing,
  items,
  market,
  titleId,
}: {
  printing: PrintingDTO;
  items: CollectionItemDTO[];
  market: number | null;
  titleId: string;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  // Historique de la carte `id` ; tant qu'il ne correspond pas à la fiche, l'ancien reste affiché, estompé.
  const [history, setHistory] = useState<{ id: string | null; points: ChartPoint[] }>({ id: null, points: [] });
  const priceHistory = history.points;
  const historyStale = history.id !== printing.id;
  const loadedOnceRef = useRef(false);
  const [costHintOpen, setCostHintOpen] = useState(false);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const previous = toAmount(printing.previousMarketPrice);
  const movement = priceMovement(market, previous);
  const marketDelta = market != null && previous != null ? market - previous : null;
  const marketDeltaPct = marketDelta != null && previous ? (marketDelta / previous) * 100 : null;

  // Gain/loss on the copies with a purchase price (EUR only), valued at the market price.
  let purchaseCost = 0;
  let pricedCopies = 0;
  for (const item of items) {
    const unit = toAmount(item.purchasePrice);
    if (unit == null || (item.purchaseCurrency ?? "EUR") !== "EUR") continue;
    purchaseCost += unit * item.quantity;
    pricedCopies += item.quantity;
  }
  const profit = market != null && pricedCopies > 0 ? market * pricedCopies - purchaseCost : null;

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const response = await fetch(
          `/api/investment/history?printingId=${encodeURIComponent(printing.id)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("history");
        const body = (await response.json()) as { points?: { day: string; amount: number }[] };
        if (cancelled) return;
        setHistory({ id: printing.id, points: (body.points ?? []).map((point) => ({ day: point.day, value: point.amount })) });
      } catch {
        if (!cancelled) setHistory({ id: printing.id, points: [] });
      }
    }
    // Navigation rapide (touche maintenue) : on attend que la fiche se stabilise avant de charger.
    const timer = window.setTimeout(() => void loadHistory(), loadedOnceRef.current ? 120 : 0);
    loadedOnceRef.current = true;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [printing.id]);

  const chart = useMemo(
    () => (
      <PriceChart
        points={priceHistory}
        label={t("modal.chartLabel")}
        height={80}
        compact
        emptyHint={t("modal.chartEmpty")}
      />
    ),
    [priceHistory, t],
  );

  // Sans prix ni historique Cardmarket, le bloc n'a rien à montrer.
  if (market == null && priceHistory.length === 0) return null;
  return (
    <section data-no-swipe="" className="hud-panel order-7 overflow-hidden md:order-none" aria-labelledby={`${titleId}-market`}>
      <div className="flex min-w-0 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h3 id={`${titleId}-market`} className="hud-label text-cyan">
              {t("modal.marketPrice")}
            </h3>
            <p className="mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums" aria-live="polite">
              {market != null ? fmt.money(market) : "—"}
            </p>
          </div>
          {movement === "up" || movement === "down" ? (
            <p className="text-[13px]" title={t("modal.trend")}>
              <TrendBadge delta={movement} amount={marketDelta} />
              {marketDeltaPct != null ? (
                <span className={`font-mono ${movement === "up" ? "text-gain" : "text-danger"}`}>
                  {" · "}
                  {formatSignedPercent(fmt, marketDeltaPct)}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className={`transition-opacity ${historyStale ? "opacity-40" : ""}`}>{chart}</div>
      </div>

      {/* Seul le gain/perte est ajouté : la valeur et le coût d'achat figurent déjà ailleurs.
          Masqué tant qu'aucun prix d'achat (EUR) ne permet de le calculer. */}
      {profit != null ? (
      <p className="flex items-baseline justify-between gap-3 border-t border-cyan/15 px-4 py-2.5 sm:px-5">
        <span className={`${fieldLabelClass} flex items-center gap-1.5`}>
          {t("modal.profitLoss")}
          {total > 0 && pricedCopies < total ? (
            <span className="group relative normal-case tracking-normal">
              <button
                type="button"
                className="relative grid h-4 w-4 place-items-center rounded-full border border-line text-[10px] leading-none text-muted transition before:absolute before:-inset-3 before:content-[''] hover:border-cyan hover:text-cyan focus-visible:border-cyan focus-visible:text-cyan focus-visible:outline-none"
                aria-label={t("modal.partialCost", { n: fmt.int(pricedCopies), total: fmt.int(total) })}
                aria-expanded={costHintOpen}
                // iOS ne donne pas le focus à un bouton touché : l'info-bulle s'ouvre au tap.
                onClick={() => setCostHintOpen((value) => !value)}
                onBlur={() => setCostHintOpen(false)}
              >
                ?
              </button>
              <span
                role="tooltip"
                className={`pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-56 ${costHintOpen ? "block" : "hidden"} border border-cyan/50 bg-black/95 px-2.5 py-1.5 font-sans text-xs leading-relaxed text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.55)] group-focus-within:block group-hover:block`}
              >
                {t("modal.partialCost", { n: fmt.int(pricedCopies), total: fmt.int(total) })}
              </span>
            </span>
          ) : null}
        </span>
        <span
          className={`font-mono text-sm tabular-nums ${
            Math.abs(profit) < 0.005 ? "text-muted" : profit > 0 ? "text-gain" : "text-danger"
          }`}
        >
          {formatSignedMoney(fmt, profit)}
        </span>
      </p>
      ) : null}
    </section>
  );
}
