"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import { TrendBadge } from "@/components/TrendBadge";
import { useWishlist } from "@/components/WishlistProvider";
import { intlLocale } from "@/lib/i18n/messages";
import { formatInt, formatMoney, priceMovement, printingTitle, wishlistTargetReached } from "@/lib/logic";
import type { CardDTO, PrintingDTO, WishlistItemDTO } from "@/lib/types";

type Row = {
  item: WishlistItemDTO;
  printing: PrintingDTO;
  card: CardDTO | undefined;
  title: string;
  market: number | null;
  previous: number | null;
  target: number | null;
  reached: boolean;
  owned: number;
};

const toAmount = (value: string | null | undefined) => {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

/** Cibles atteintes d'abord, puis les plus proches de leur cible, puis les cartes sans cible. */
function compareRows(a: Row, b: Row) {
  if (a.reached !== b.reached) return a.reached ? -1 : 1;
  const gap = (row: Row) => (row.target && row.market != null ? row.market / row.target : Number.POSITIVE_INFINITY);
  return gap(a) - gap(b) || a.title.localeCompare(b.title, "fr");
}

export function WishlistScreen() {
  const { t, locale } = useI18n();
  const { catalog, items: collection, ready: collectionReady, error } = useCollection();
  const wishlist = useWishlist();
  const { acknowledge } = wishlist;
  // Alertes nouvelles à l'ouverture : restent signalées le temps de la visite, puis sont marquées vues.
  const [freshIds, setFreshIds] = useState<Set<string> | null>(null);

  if (wishlist.ready && freshIds === null) {
    setFreshIds(new Set(wishlist.items.filter((item) => item.alertAt && !item.alertSeen).map((item) => item.id)));
  }

  useEffect(() => {
    if (freshIds && freshIds.size > 0) void acknowledge();
  }, [acknowledge, freshIds]);

  const rows = useMemo(() => {
    if (!catalog) return [];
    const printings = new Map(catalog.printings.map((printing) => [printing.id, printing]));
    const cards = new Map(catalog.cards.map((card) => [card.id, card]));
    const owned = new Map<string, number>();
    for (const line of collection) owned.set(line.printingId, (owned.get(line.printingId) ?? 0) + line.quantity);
    const result: Row[] = [];
    for (const item of wishlist.items) {
      const printing = printings.get(item.printingId);
      if (!printing) continue;
      const card = cards.get(printing.cardId);
      const market = toAmount(printing.marketPrice);
      const target = toAmount(item.targetPrice);
      result.push({
        item,
        printing,
        card,
        title: printingTitle(card, printing),
        market,
        previous: toAmount(printing.previousMarketPrice),
        target,
        reached: wishlistTargetReached(target, market),
        owned: owned.get(printing.id) ?? 0,
      });
    }
    return result.sort(compareRows);
  }, [catalog, collection, wishlist.items]);

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!collectionReady || !catalog || !wishlist.ready) return <p className="p-6 text-muted">{t.common.loading}</p>;

  const reachedCount = rows.filter((row) => row.reached).length;
  const total = rows.reduce((sum, row) => sum + (row.market ?? 0), 0);
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <div>
        <h1 className="text-2xl text-yellow sm:text-4xl">{t.wishlist.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t.wishlist.subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-line bg-panel p-5">
          <p className="text-sm text-muted">{t.wishlist.empty}</p>
          <Link
            href="/cards"
            className="inline-flex h-11 items-center bg-yellow px-4 text-sm font-semibold text-black hover:brightness-110"
          >
            {t.wishlist.browse}
          </Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label={t.wishlist.statCards} value={formatInt(rows.length)} />
            <Stat
              label={t.wishlist.statReached}
              value={formatInt(reachedCount)}
              tone={reachedCount > 0 ? "gain" : undefined}
            />
            <Stat label={t.wishlist.statTotal} value={total > 0 ? formatMoney(total) : "—"} />
          </section>

          <ul className="flex flex-col border border-line bg-panel">
            {rows.map((row) => (
              <WishRow
                key={`${row.item.id}:${row.item.targetPrice ?? ""}`}
                row={row}
                fresh={freshIds?.has(row.item.id) ?? false}
                since={row.reached && row.item.alertAt ? dateFormat.format(new Date(row.item.alertAt)) : null}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" }) {
  return (
    <div className="min-w-0 border border-line bg-panel px-3 py-3 sm:px-4">
      <p className="truncate text-[11px] tracking-[0.12em] text-muted uppercase sm:text-xs">{label}</p>
      <p className={`mt-2 text-xl sm:text-2xl ${tone === "gain" ? "text-gain" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function WishRow({ row, fresh, since }: { row: Row; fresh: boolean; since: string | null }) {
  const { t } = useI18n();
  const { patch, remove } = useWishlist();
  const [target, setTarget] = useState(row.item.targetPrice ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const movement = priceMovement(row.market, row.previous);
  const gap = row.target != null && row.market != null && !row.reached ? row.market - row.target : null;

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.wishlist.failed);
    } finally {
      setPending(false);
    }
  }

  function commitTarget() {
    const next = target.trim();
    if (next === (row.item.targetPrice ?? "")) return;
    void run(() => patch(row.item.id, { targetPrice: next || null }));
  }

  return (
    <li
      className={`flex flex-col gap-3 border-t border-line/60 p-3 first:border-t-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-4 ${
        row.reached ? "bg-gain/5" : ""
      }`}
    >
      <Link
        href={`/cards?printing=${encodeURIComponent(row.printing.id)}`}
        className="flex min-w-0 flex-1 items-center gap-3 hover:text-cyan"
        aria-label={t.wishlist.openCard(row.title)}
      >
        {row.printing.imagePath ? (
          <CardImage src={row.printing.imagePath} alt="" className="h-16 w-12 shrink-0 bg-black object-contain" loading="lazy" />
        ) : (
          <span className="grid h-16 w-12 shrink-0 place-items-center bg-black text-[10px] text-muted">N/A</span>
        )}
        <span className="min-w-0">
          <span className="block font-mono text-xs text-muted">
            #{row.printing.collectorNumber} · {row.printing.setName}
          </span>
          <span className="block truncate">{row.title}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {row.reached ? (
              <span className="inline-flex h-5 items-center border border-gain/45 bg-gain/10 px-1.5 text-[11px] text-gain">
                {since ? t.wishlist.reachedSince(since) : t.wishlist.targetReached}
              </span>
            ) : null}
            {fresh ? (
              <span className="inline-flex h-5 items-center bg-yellow px-1.5 text-[11px] font-semibold text-black">
                {t.wishlist.alertNew}
              </span>
            ) : null}
            {row.owned > 0 ? (
              <span className="inline-flex h-5 items-center border border-line px-1.5 text-[11px] text-muted">
                {t.wishlist.owned(formatInt(row.owned))}
              </span>
            ) : null}
          </span>
        </span>
      </Link>

      <div className="flex items-end gap-3 sm:shrink-0">
        <div className="min-w-[6.5rem]">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.wishlist.currentPrice}</p>
          <p className="flex items-baseline gap-1.5 font-mono text-sm tabular-nums">
            {row.market != null ? formatMoney(row.market) : t.wishlist.noPrice}
            {movement === "up" || movement === "down" ? <TrendBadge delta={movement} /> : null}
          </p>
          {gap != null ? <p className="font-mono text-[11px] text-muted">{t.wishlist.gap(formatMoney(gap))}</p> : null}
        </div>
        <label className="w-28">
          <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.wishlist.targetPrice}</span>
          <span className="flex h-10 border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
            <input
              className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none"
              inputMode="decimal"
              placeholder="—"
              value={target}
              disabled={pending}
              onChange={(event) => setTarget(event.target.value)}
              onBlur={commitTarget}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className="grid place-items-center border-l border-line bg-panel px-1.5 font-mono text-xs text-muted">€</span>
          </span>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => remove(row.item.id))}
          className="grid h-10 w-10 shrink-0 place-items-center border border-line text-muted transition hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/70 disabled:opacity-50"
          aria-label={t.wishlist.removeCard(row.title)}
          title={t.wishlist.remove}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
          </svg>
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {message}
        </p>
      ) : null}
    </li>
  );
}
