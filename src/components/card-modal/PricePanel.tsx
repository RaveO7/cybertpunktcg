"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale, type Locale } from "@/i18n/config";
import { Link, useRouter, type Href } from "@/i18n/navigation";
import { useNumberFormat } from "@/i18n/number-format";
import { PriceChart, type ChartPoint } from "@/components/PriceChart";
import { formatSignedMoney, formatSignedPercent } from "@/components/TrendBadge";
import { fieldLabelClass, toAmount } from "@/components/card-modal/shared";
import { amountSign, priceMovement } from "@/lib/logic";
import type { CollectionItemDTO, PrintingDTO } from "@/lib/types";

/** Jour du dernier changement de prix : premier point de la série finale au prix actuel (null si inconnu). */
function lastChangeDay(points: ChartPoint[], market: number | null) {
  if (market == null) return null;
  let index = points.length;
  while (index > 0 && amountSign(points[index - 1].value - market) === 0) index -= 1;
  return index > 0 && index < points.length ? points[index].day : null;
}

// Pastille du pourcentage : même style que le badge P&L de la courbe d'investissement.
const HINT_TONES = {
  gain: { chip: "border-gain/40 bg-gain/10 text-gain hover:bg-gain/20", text: "text-gain" },
  loss: { chip: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20", text: "text-danger" },
  flat: { chip: "border-line bg-white/5 text-muted hover:bg-white/10", text: "text-muted" },
} as const;

/** Pourcentage affiché ; le montant apparaît dans une info-bulle (survol, focus ou toucher). */
function PercentHint({
  id,
  percent,
  amount,
  tone,
  className,
  tooltipClassName,
}: {
  id: string;
  percent: string;
  amount: string;
  tone: keyof typeof HINT_TONES;
  /** Taille du pourcentage. */
  className: string;
  /** Position de l'info-bulle. */
  tooltipClassName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group/hint pointer-events-auto relative inline-block">
      <button
        type="button"
        className={`border px-1.5 py-1 font-mono leading-none tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current ${className} ${HINT_TONES[tone].chip}`}
        aria-describedby={id}
        aria-expanded={open}
        // iOS ne donne pas le focus à un bouton touché : l'info-bulle s'ouvre au tap.
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        {percent}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-10 whitespace-nowrap ${tooltipClassName} ${open ? "block" : "hidden"} border border-cyan/50 bg-black/95 px-2.5 py-1.5 font-mono text-sm tabular-nums shadow-[0_8px_24px_rgba(0,0,0,0.55)] group-focus-within/hint:block group-hover/hint:block ${HINT_TONES[tone].text}`}
      >
        {amount}
      </span>
    </span>
  );
}

/**
 * Prix de la fiche : prix tendance, variation, historique, valeur et gain / perte sur les exemplaires possédés.
 * Chargé à la demande par la fiche (graphique compris). Un clic sur le bloc ouvre l'investissement de la carte.
 */
export function PricePanel({
  printing,
  items,
  market,
  titleId,
  linkToInvestment = false,
}: {
  printing: PrintingDTO;
  items: CollectionItemDTO[];
  market: number | null;
  titleId: string;
  linkToInvestment?: boolean;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  // Historique de la carte `id` ; tant qu'il ne correspond pas à la fiche, l'ancien reste affiché, estompé.
  const [history, setHistory] = useState<{ id: string | null; points: ChartPoint[] }>({ id: null, points: [] });
  const priceHistory = history.points;
  const historyStale = history.id !== printing.id;
  const loadedOnceRef = useRef(false);
  // Type du dernier appui sur le graphique : seul un clic de souris y ouvre l'investissement (le doigt sert à lire la courbe).
  const chartPointerRef = useRef<string | null>(null);
  const [costHintOpen, setCostHintOpen] = useState(false);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const previous = toAmount(printing.previousMarketPrice);
  const movement = priceMovement(market, previous);
  const marketDelta = market != null && previous != null ? market - previous : null;
  const marketDeltaPct = marketDelta != null && previous ? (marketDelta / previous) * 100 : null;
  const changeDay = historyStale ? null : lastChangeDay(priceHistory, market);
  // Exemplaires possédés : l'investissement s'ouvre avec leurs lignes sélectionnées.
  const investmentHref: Href = total > 0 ? { pathname: "/investissement", query: { printing: printing.id } } : "/investissement";

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
  const profitPct = profit != null && purchaseCost > 0 ? (profit / purchaseCost) * 100 : null;
  const profitSign = profit == null ? 0 : amountSign(profit);
  const profitTone = profitSign === 0 ? "flat" : profitSign > 0 ? "gain" : "loss";
  const profitClass = HINT_TONES[profitTone].text;
  // Un seul exemplaire : sa valeur est le prix affiché au-dessus, inutile de la répéter.
  const totalValue = market != null && total > 1 ? market * total : null;
  const bothStats = totalValue != null && profit != null;

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

  const priceBlock = (
    <div className="min-w-0">
      <h3 id={`${titleId}-market`} className="hud-label text-cyan">
        {t("modal.marketPrice")}
        {linkToInvestment ? (
          <span aria-hidden="true" className="ml-1.5 inline-block transition-transform group-hover/price:translate-x-0.5">
            →
          </span>
        ) : null}
      </h3>
      <p className="mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums" aria-live="polite">
        {market != null ? fmt.money(market) : "—"}
      </p>
    </div>
  );

  const deltaClass = movement === "up" ? "text-gain" : "text-danger";
  // Hors du lien et au-dessus de lui : le pourcentage s'ouvre au toucher sans mener à l'investissement.
  const variation =
    (movement === "up" || movement === "down") && marketDelta != null ? (
      <div className="pointer-events-none relative z-20 @sm:text-right">
        <p className="hud-label">
          {movement === "up" ? t("modal.lastRise") : t("modal.lastDrop")}
          {changeDay
            ? ` · ${new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(
                new Date(`${changeDay}T00:00:00.000Z`),
              )}`
            : null}
        </p>
        {marketDeltaPct != null ? (
          <div className="mt-1">
            <PercentHint
              id={`${titleId}-delta`}
              percent={formatSignedPercent(fmt, marketDeltaPct)}
              amount={formatSignedMoney(fmt, marketDelta)}
              tone={movement === "up" ? "gain" : "loss"}
              className="text-base font-semibold"
              tooltipClassName="left-0 top-full mt-1.5 @sm:left-auto @sm:right-0"
            />
          </div>
        ) : (
          <p className={`mt-1 font-mono text-[13px] tabular-nums ${deltaClass}`}>{formatSignedMoney(fmt, marketDelta)}</p>
        )}
      </div>
    ) : null;

  return (
    <section
      data-no-swipe=""
      className={`hud-panel group/price order-7 overflow-hidden md:order-none ${
        linkToInvestment ? "relative transition-colors hover:border-cyan/70" : ""
      }`}
      aria-labelledby={`${titleId}-market`}
    >
      <div className="@container flex min-w-0 flex-col gap-2.5 p-4">
        {/* Bloc étroit (téléphone) : la variation passe sous le prix, alignée à gauche. */}
        <div className="flex flex-col gap-2 @sm:flex-row @sm:items-end @sm:justify-between @sm:gap-4">
          {linkToInvestment ? (
            // Lien étiré sur tout le bloc ; la variation, le graphique et le « ? » restent au-dessus pour garder leurs interactions.
            <Link
              href={investmentHref}
              title={t("modal.openInvestment")}
              className="block min-w-0 before:absolute before:inset-0 before:rounded-[inherit] before:content-[''] focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-inset focus-visible:before:ring-cyan"
            >
              {priceBlock}
            </Link>
          ) : (
            priceBlock
          )}
          {variation}
        </div>
        <div
          className={`transition-opacity ${historyStale ? "opacity-40" : ""} ${linkToInvestment ? "relative z-10 cursor-pointer" : ""}`}
          onPointerDown={linkToInvestment ? (event) => (chartPointerRef.current = event.pointerType) : undefined}
          onClick={
            linkToInvestment
              ? () => {
                  if (chartPointerRef.current === "mouse") router.push(investmentHref);
                }
              : undefined
          }
        >
          {chart}
        </div>
      </div>

      {/* Valeur totale (plusieurs exemplaires) et gain/perte (dès qu'un prix d'achat en EUR permet de le calculer). */}
      {totalValue != null || profit != null ? (
        <div className={`border-t border-cyan/15 px-4 py-2.5 sm:px-5 ${bothStats ? "grid grid-cols-2 gap-4" : ""}`}>
          {totalValue != null ? (
            <p className={bothStats ? "flex flex-col gap-1" : "flex items-baseline justify-between gap-3"}>
              <span className={`${fieldLabelClass} flex items-center gap-1.5`}>
                {t("modal.totalValue")}
                <span className="normal-case tracking-normal">×{fmt.int(total)}</span>
              </span>
              <span className="font-mono text-sm tabular-nums">{fmt.money(totalValue)}</span>
            </p>
          ) : null}
          {profit != null ? (
            <p className={bothStats ? "flex flex-col items-end gap-1 text-right" : "flex items-baseline justify-between gap-3"}>
              <span className={`${fieldLabelClass} flex items-center gap-1.5`}>
                {t("modal.profitLoss")}
                {total > 0 && pricedCopies < total ? (
                  <span className="group relative z-10 normal-case tracking-normal">
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
                      className={`pointer-events-none absolute bottom-full ${bothStats ? "right-0" : "left-0"} z-10 mb-2 w-56 ${costHintOpen ? "block" : "hidden"} border border-cyan/50 bg-black/95 px-2.5 py-1.5 font-sans text-xs leading-relaxed text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.55)] group-focus-within:block group-hover:block`}
                    >
                      {t("modal.partialCost", { n: fmt.int(pricedCopies), total: fmt.int(total) })}
                    </span>
                  </span>
                ) : null}
              </span>
              {profitPct != null ? (
                <PercentHint
                  id={`${titleId}-profit`}
                  percent={formatSignedPercent(fmt, profitPct)}
                  amount={formatSignedMoney(fmt, profit)}
                  tone={profitTone}
                  className="text-sm"
                  tooltipClassName="bottom-full right-0 mb-1.5"
                />
              ) : (
                <span className={`font-mono text-sm tabular-nums ${profitClass}`}>{formatSignedMoney(fmt, profit)}</span>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
