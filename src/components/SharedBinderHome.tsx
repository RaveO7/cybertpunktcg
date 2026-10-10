"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSharedBinder } from "@/components/SharedBinderProvider";
import { useI18n } from "@/components/LocaleProvider";
import { TradesPanel, tradesHref, useTradeList } from "@/components/TradesPanel";
import {
  aggregateCollection,
  computeProgress,
  formatInt,
  formatPercent,
  marketValue,
  releasedChecklist,
  viewOwnership,
} from "@/lib/logic";
import {
  BETA_SET_CODE,
  ENGLISH_SET_ID,
  FRENCH_SET_ID,
  MAIN_SET_CODE,
} from "@/lib/reference-data";
import type { Ownership } from "@/lib/types";

const SCOPES = [
  { id: "en", checklist: ENGLISH_SET_ID, language: "en" as const },
  { id: "fr", checklist: FRENCH_SET_ID, language: "fr" as const },
];

export function SharedBinderHome() {
  const { ready, error, data } = useSharedBinder();
  const { t } = useI18n();

  const agg = useMemo(() => {
    if (!data) return new Map<string, Ownership>();
    return aggregateCollection(data.items);
  }, [data]);

  const trades = useTradeList(data?.catalog.printings, data?.catalog.cards, agg);

  const scopes = useMemo(() => {
    if (!data) return [];
    return SCOPES.map((scope) => {
      const printings = releasedChecklist(data.catalog.printings, scope.checklist) ?? [];
      const ownership = viewOwnership(scope.checklist, data.catalog.printings, agg);
      const progress = computeProgress(printings, ownership);
      const market = marketValue(printings, ownership);
      return { ...scope, progress, market };
    });
  }, [agg, data]);

  if (!ready) return <p className="p-6 text-muted">{t.common.loading}</p>;
  if (error === "not_found" || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl text-yellow">{t.share.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.share.notFoundBody}</p>
      </div>
    );
  }
  if (error) return <p className="p-6 text-danger">{t.share.loadFailed}</p>;

  const cardsHref = `/classeur/${data.token}/cartes`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t.share.eyebrow}</p>
      <h1 className="mt-1 text-3xl text-yellow">{t.share.title(data.ownerName)}</h1>
      <p className="mt-2 text-sm text-muted">{t.share.subtitle}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {scopes.map((scope) => (
          <div key={scope.id} className="border border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {scope.language === "fr" ? t.common.french : t.common.english}
            </p>
            <p className="mt-2 text-2xl text-foreground">
              {formatInt(scope.progress.uniqueOwned)}
              <span className="text-sm text-muted"> / {formatInt(scope.progress.total)}</span>
            </p>
            <p className="mt-1 text-sm text-cyan">{formatPercent(scope.progress.percent)}</p>
            <p className="mt-3 text-xs text-muted">
              {t.dashboard.missing}: {formatInt(scope.progress.missing)} · {t.dashboard.duplicates}:{" "}
              {formatInt(scope.progress.duplicates)}
            </p>
            {data.catalog.hasPrices && scope.market.pricedCopies > 0 ? (
              <p className="mt-2 text-xs text-muted">
                {t.share.marketHint(formatInt(scope.market.pricedCopies))}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`${cardsHref}?collection=owned`}
          className="inline-flex h-12 items-center border border-cyan px-4 text-sm text-cyan hover:bg-cyan/10"
        >
          {t.share.openOwned}
        </Link>
        {trades && trades.lines.length > 0 ? (
          <Link
            href={tradesHref(cardsHref)}
            className="inline-flex h-12 items-center border border-yellow px-4 text-sm text-yellow hover:bg-yellow/10"
          >
            {t.share.openTrades}
          </Link>
        ) : null}
        <Link
          href={cardsHref}
          className="inline-flex h-12 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground"
        >
          {t.share.openAll}
        </Link>
      </div>

      {trades ? (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">{t.trades.title}</h2>
          <p className="mt-1 mb-3 text-sm text-muted">{t.share.tradesHint(data.ownerName)}</p>
          <TradesPanel list={trades} hasPrices={data.catalog.hasPrices} cardsPath={cardsHref} />
        </section>
      ) : null}

      <p className="mt-8 text-xs text-muted">
        {t.share.editionsNote} ({BETA_SET_CODE} / {MAIN_SET_CODE})
      </p>
    </div>
  );
}
