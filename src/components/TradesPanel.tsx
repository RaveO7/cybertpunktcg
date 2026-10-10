"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { cardLabel } from "@/lib/deck-rules";
import { formatInt, formatMoney } from "@/lib/logic";
import { ALL_SETS_ID } from "@/lib/reference-data";
import { tradeList, type TradeList } from "@/lib/trades";
import type { CardDTO, Ownership, PrintingDTO } from "@/lib/types";

const PREVIEW = 8;

/** Lien vers l'explorateur, filtré sur les cartes en trop (toutes extensions et langues). */
export function tradesHref(cardsPath: string, printingId?: string) {
  const params = new URLSearchParams({ set: ALL_SETS_ID, collection: "extras" });
  if (printingId) params.set("printing", printingId);
  return `${cardsPath}?${params}`;
}

export function useTradeList(
  printings: PrintingDTO[] | undefined,
  cards: CardDTO[] | undefined,
  agg: Map<string, Ownership>,
): TradeList | null {
  return useMemo(() => {
    if (!printings || !cards) return null;
    return tradeList(printings, new Map(cards.map((card) => [card.id, card])), agg);
  }, [agg, cards, printings]);
}

/**
 * Exemplaires au-delà de la limite par deck. `cardsPath` est la page Cartes (« /cards » ou celle
 * du classeur partagé) : chaque ligne ouvre la carte, filtrée sur « En trop ».
 */
export function TradesPanel({
  list,
  hasPrices,
  cardsPath,
}: {
  list: TradeList;
  hasPrices: boolean;
  cardsPath: string;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (list.lines.length === 0) {
    return <p className="hud-panel px-4 py-8 text-center text-sm text-muted">{t.trades.empty}</p>;
  }

  const lines = expanded ? list.lines : list.lines.slice(0, PREVIEW);
  const priced = hasPrices && list.value > 0;

  return (
    <div className="hud-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/60 px-4 py-3">
        <p className="text-sm text-foreground">
          {t.trades.summary(formatInt(list.lines.length), formatInt(list.extraCopies))}
        </p>
        {priced ? (
          <p className="text-xs text-muted">
            {list.unpricedCopies > 0
              ? t.trades.valuePartial(formatMoney(list.value), formatInt(list.unpricedCopies))
              : t.trades.value(formatMoney(list.value))}
          </p>
        ) : null}
      </div>
      <ul>
        {lines.map((line) => (
          <li key={line.card.id} className="border-t border-line/60 first:border-t-0">
            <Link
              href={tradesHref(cardsPath, line.printings[0]?.printing.id)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-cyan/[0.04]"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm text-foreground">
                  {cardLabel(line.card)}
                  {line.card.cardType ? <span className="ml-2 text-xs text-muted">{line.card.cardType}</span> : null}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {line.printings.map(({ printing, quantity }) => (
                    <span
                      key={printing.id}
                      className="border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted"
                    >
                      {printing.setCode.toUpperCase()} {printing.collectorNumber} · {printing.language.toUpperCase()} ×
                      {quantity}
                    </span>
                  ))}
                </span>
                <span className="text-xs text-muted">
                  {t.trades.ownedOfLimit(formatInt(line.owned), formatInt(line.limit))}
                  {hasPrices && line.unitPrice != null ? ` · ${t.trades.unitPrice(formatMoney(line.unitPrice))}` : null}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-mono text-xl text-yellow">+{formatInt(line.extra)}</span>
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{t.trades.extra}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 px-4 py-3">
        {list.lines.length > PREVIEW ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="min-h-10 border border-line px-3 text-sm text-muted hover:border-cyan hover:text-foreground"
          >
            {expanded ? t.trades.showLess : t.trades.showAll(formatInt(list.lines.length))}
          </button>
        ) : (
          <span />
        )}
        <Link href={tradesHref(cardsPath)} className="text-sm text-cyan hover:text-foreground">
          {t.trades.openCards} →
        </Link>
      </div>
    </div>
  );
}
