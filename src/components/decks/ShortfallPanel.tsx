"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useWishlist } from "@/components/WishlistProvider";
import { Stat, buttonClass, copyText } from "@/components/decks/ui";
import { cardLabel, type Shortfall } from "@/lib/deck-rules";
import type { PrintingDTO } from "@/lib/types";

type WishlistStatus = { ok: true; added: number; present: number } | { ok: false; message: string };

/** Récapitulatif en fin de deck : manquantes, prix du deck complet, reste à acheter et liste d'achat. */
export function ShortfallPanel({
  shortfall,
  printingsByCard,
}: {
  shortfall: Shortfall;
  printingsByCard: Map<string, PrintingDTO[]>;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const wishlist = useWishlist();
  const [copied, setCopied] = useState<boolean | null>(null);
  const [wishing, setWishing] = useState(false);
  const [wished, setWished] = useState<WishlistStatus | null>(null);
  if (shortfall.totalCopies === 0) return null;
  const missing = shortfall.lines.filter((line) => line.missing > 0).sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1));
  const complete = missing.length === 0;
  const text = missing.map((line) => `${line.missing} ${cardLabel(line.card)}`).join("\n");

  // Tirage le moins cher de chaque carte manquante, sinon son premier tirage.
  async function addToWishlist() {
    const ids = missing
      .map((line) => line.cheapestPrintingId ?? printingsByCard.get(line.card.id)?.[0]?.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    setWishing(true);
    setWished(null);
    try {
      const { added, alreadyPresent } = await wishlist.addMany(ids);
      setWished({ ok: true, added, present: alreadyPresent });
    } catch (error) {
      setWished({ ok: false, message: error instanceof Error ? error.message : t("decks.failed") });
    } finally {
      setWishing(false);
    }
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="deck-recap">
      <h2 id="deck-recap" className="hud-label">
        {t("decks.recapTitle")}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t("decks.missingCards")}
          value={`${fmt.int(shortfall.missingCopies)}/${fmt.int(shortfall.totalCopies)}`}
          tone={complete ? "gain" : undefined}
        />
        <Stat
          label={t("decks.deckCost")}
          value={fmt.money(shortfall.deckCost)}
          hint={shortfall.deckUnpricedCopies > 0 ? t("decks.unpriced", { n: shortfall.deckUnpricedCopies }) : undefined}
        />
        <Stat
          label={t("decks.toBuy")}
          value={complete ? t("decks.complete") : fmt.money(shortfall.missingCost)}
          hint={shortfall.unpricedCopies > 0 ? t("decks.unpriced", { n: shortfall.unpricedCopies }) : undefined}
          tone={complete ? "gain" : undefined}
        />
      </div>
      {complete ? (
        <p className="border border-gain/45 bg-gain/10 px-3 py-2 text-sm text-gain sm:px-4">{t("decks.allOwned")}</p>
      ) : (
        <div className="border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-2 sm:px-4">
            <h3 className="hud-label">
              {t("decks.missingTitle")} · {fmt.int(shortfall.missingCopies)}
            </h3>
            <span className="ml-auto flex items-center gap-2">
              {copied != null ? (
                <span className={`text-xs ${copied ? "text-gain" : "text-danger"}`} aria-live="polite">
                  {copied ? t("decks.copied") : t("decks.copyFailed")}
                </span>
              ) : null}
              <button type="button" className={`${buttonClass} h-8 px-2 text-xs`} onClick={() => void copyText(text).then(setCopied)}>
                {t("decks.copyList")}
              </button>
              <button
                type="button"
                className={`${buttonClass} h-8 px-2 text-xs`}
                disabled={wishing}
                onClick={() => void addToWishlist()}
              >
                {t("decks.addMissingToWishlist")}
              </button>
            </span>
          </div>
          {wished ? (
            <p
              role={wished.ok ? "status" : "alert"}
              className={`border-b border-line/60 px-3 py-1.5 text-xs sm:px-4 ${wished.ok ? "text-gain" : "text-danger"}`}
            >
              {wished.ok ? t("decks.addedToWishlist", { added: wished.added, present: wished.present }) : wished.message}
            </p>
          ) : null}
          <ul className="text-sm">
            {missing.map((line) => (
              <li key={line.card.id} className="flex items-center gap-3 border-t border-line/40 px-3 py-1.5 first:border-t-0 sm:px-4">
                <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted">×{line.missing}</span>
                <span
                  className="min-w-0 flex-1 truncate"
                  title={line.unitPrice != null ? `${cardLabel(line.card)} · ${t("decks.priceEach", { amount: fmt.money(line.unitPrice) })}` : cardLabel(line.card)}
                >
                  {cardLabel(line.card)}
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
                  {line.cost != null ? fmt.money(line.cost) : t("decks.noPrice")}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-between gap-3 border-t border-line/60 px-3 py-2 text-sm sm:px-4">
            <span className="text-[11px] text-muted">{t("decks.missingHint")}</span>
            <span className="font-mono tabular-nums">{fmt.money(shortfall.missingCost)}</span>
          </p>
        </div>
      )}
    </section>
  );
}
