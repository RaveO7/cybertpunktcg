"use client";

import { useId, useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { formatMoney, wishlistTargetReached } from "@/lib/logic";

/** Bloc de la fiche carte : ajout à la liste de souhaits et prix cible de l'alerte. */
export function WishlistPanel({ printingId, marketPrice }: { printingId: string; marketPrice: number | null }) {
  const { t } = useI18n();
  const wishlist = useWishlist();
  const headingId = useId();
  const item = wishlist.items.find((entry) => entry.printingId === printingId) ?? null;
  const [target, setTarget] = useState(item?.targetPrice ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Autre tirage ouvert ou cible enregistrée (normalisée par le serveur) : le champ suit.
  const syncKey = `${printingId}|${item?.targetPrice ?? ""}`;
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setTarget(item?.targetPrice ?? "");
  }

  if (!wishlist.ready) return null;

  const savedTarget = item?.targetPrice != null ? Number(item.targetPrice) : null;
  const reached = wishlistTargetReached(savedTarget, marketPrice);
  const dirty = target.trim() !== (item?.targetPrice ?? "");

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

  function submit() {
    const targetPrice = target.trim() || null;
    void run(() => (item ? wishlist.patch(item.id, { targetPrice }) : wishlist.save(printingId, { targetPrice })));
  }

  return (
    <section data-no-swipe="" className="hud-panel order-6 overflow-hidden md:order-none" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3 border-b border-cyan/15 px-4 py-3 sm:px-5">
        <h3 id={headingId} className="hud-label text-cyan">
          {t.wishlist.title}
        </h3>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="w-32">
          <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.wishlist.targetPrice}</span>
          <span className="flex h-10 border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
            <input
              className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none"
              inputMode="decimal"
              placeholder={marketPrice != null ? marketPrice.toFixed(2) : "—"}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
            <span className="grid place-items-center border-l border-line bg-panel px-1.5 font-mono text-xs text-muted">€</span>
          </span>
        </label>
        {!item || dirty ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 bg-yellow px-3 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow/80 disabled:opacity-60"
          >
            {item ? t.wishlist.save : t.wishlist.add}
          </button>
        ) : null}
        {item ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run(() => wishlist.remove(item.id))}
            className="inline-flex h-10 items-center border border-line px-3 text-sm text-muted transition hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/70 disabled:opacity-60"
          >
            {t.wishlist.remove}
          </button>
        ) : null}
        <p className="basis-full text-xs text-muted">
          {reached && marketPrice != null ? (
            <span className="text-gain">
              {t.wishlist.targetReached} · {formatMoney(marketPrice)}
            </span>
          ) : (
            t.wishlist.targetHint
          )}
        </p>
        {message ? (
          <p role="alert" className="basis-full text-sm text-danger">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
