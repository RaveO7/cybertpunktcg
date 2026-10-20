"use client";

import { useState } from "react";
import { usePathname as useBrowserPathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CardImage } from "@/components/CardImage";
import { colorDotClass } from "@/components/CardTile";
import { useCollection } from "@/components/CollectionProvider";
import { readCached, writeCached } from "@/components/data-cache";
import { buttonClass, copyText, issueText, panelClass, primaryClass, ValidityBadge } from "@/components/decks/ui";
import { sendJson, useRequestErrors } from "@/components/send-json";
import { Link, useRouter } from "@/i18n/navigation";
import { useNumberFormat } from "@/i18n/number-format";
import { cardLabel, type DeckEntry, type DeckLine } from "@/lib/deck-rules";
import type { SharedDeckSummary } from "@/lib/deck-share";
import type { DeckDTO } from "@/lib/types";

type Props = {
  name: string;
  ownerName: string;
  summary: SharedDeckSummary;
  /** Image de chaque Legend (tirage anglais de préférence). */
  legendImages: Record<string, string>;
};

/** Page publique d'un deck partagé : lecture seule, rendue côté serveur, sans donnée privée. */
export function SharedDeckView({ name, ownerName, summary, legendImages }: Props) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const { analysis, groups } = summary;
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[900px] flex-col gap-5 px-3 pt-4 pb-24 sm:gap-6 sm:px-4 sm:py-6">
      <header className="flex flex-col gap-2">
        <p className="hud-label">{t("decks.sharedEyebrow")}</p>
        <h1 className="font-display text-2xl break-words text-yellow sm:text-3xl">{name}</h1>
        <p className="text-sm text-muted">{t("decks.sharedBy", { name: ownerName })}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ValidityBadge analysis={analysis} />
          <span className="tabular-nums">{t("decks.sharedTotal", { n: summary.totalCards })}</span>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span>
            {t("decks.deckCost")} : <strong className="tabular-nums">{fmt.money(summary.deckCost)}</strong>
            {summary.unpricedCopies > 0 ? <span className="text-muted"> {t("decks.unpriced", { n: summary.unpricedCopies })}</span> : null}
          </span>
        </div>
        <SharedDeckActions name={name} text={summary.text} cards={[...analysis.legends, ...analysis.main]} />
      </header>

      {analysis.issues.length > 0 ? (
        <section className={`${panelClass} p-3 sm:p-4`} aria-labelledby="shared-deck-issues">
          <h2 id="shared-deck-issues" className="hud-label mb-2 text-danger">
            {t("decks.issueCount", { n: analysis.issues.length })}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {analysis.issues.map((issue, position) => (
              <li key={`${issue.code}-${position}`} className="flex gap-2">
                <span aria-hidden="true" className="text-danger">
                  !
                </span>
                {issueText(t, issue)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="shared-deck-legends">
        <h2 id="shared-deck-legends" className="hud-label mb-2">
          {t("decks.legends")} · {fmt.int(analysis.legendCount)}
        </h2>
        {analysis.legends.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:max-w-md">
            {analysis.legends.map((line) => (
              <li key={line.card.id} className="min-w-0">
                {legendImages[line.card.id] ? (
                  <CardImage
                    src={legendImages[line.card.id]}
                    alt={cardLabel(line.card)}
                    className="aspect-[63/88] w-full rounded-md bg-black object-contain"
                  />
                ) : (
                  <span className="grid aspect-[63/88] w-full place-items-center rounded-md bg-black text-xs text-muted">N/A</span>
                )}
                <p className="mt-1 truncate text-[11px]" title={cardLabel(line.card)}>
                  {line.quantity > 1 ? `${line.quantity} × ` : ""}
                  {cardLabel(line.card)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("decks.noLegends")}</p>
        )}
      </section>

      {groups.length > 0 ? (
        <section className={panelClass} aria-label={t("decks.mainDeck")}>
          {groups.map((group) => (
            <div key={group.key} className="border-t border-line/60 first:border-t-0">
              <h3 className="hud-label flex justify-between px-3 pt-3 pb-1">
                <span>{group.key === "other" ? t("decks.otherCards") : group.key}</span>
                <span className="tabular-nums">{fmt.int(group.lines.reduce((sum, line) => sum + line.quantity, 0))}</span>
              </h3>
              <ul className="pb-1.5">
                {group.lines.map((line) => (
                  <SharedDeckRow key={line.card.id} line={line} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SharedDeckRow({ line }: { line: DeckLine }) {
  const t = useTranslations();
  const { card } = line;
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <span className="w-6 shrink-0 text-right font-mono tabular-nums text-yellow">{line.quantity}</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate" title={cardLabel(card)}>
        {cardLabel(card)}
      </span>
      {card.cost != null ? (
        <span className="shrink-0 text-xs text-muted tabular-nums" title={t("decks.cost")}>
          {card.cost}
        </span>
      ) : null}
    </li>
  );
}

/** Copie de la liste texte, et copie du deck dans ses decks (connexion d'abord pour un visiteur). */
function SharedDeckActions({ name, text, cards }: { name: string; text: string; cards: DeckLine[] }) {
  const t = useTranslations();
  const router = useRouter();
  const errors = useRequestErrors();
  const pathname = useBrowserPathname();
  const { user, session } = useCollection();
  const [copied, setCopied] = useState<boolean | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyToMyDecks() {
    setCopying(true);
    setError(null);
    try {
      const entries: DeckEntry[] = cards.map((line) => ({ cardId: line.card.id, quantity: line.quantity }));
      const { deck } = await sendJson<{ deck: DeckDTO }>(
        "/api/decks",
        { method: "POST", body: JSON.stringify({ name, cards: entries }) },
        errors,
      );
      // L'écran des decks affiche d'abord sa copie en cache : on y ajoute le nouveau deck.
      const cached = readCached<{ decks: DeckDTO[] }>("/api/decks");
      if (cached) writeCached("/api/decks", { decks: [deck, ...cached.decks] });
      router.push({ pathname: "/decks", query: { deck: deck.id } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("decks.copyFailed"));
      setCopying(false);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {user ? (
        <button type="button" className={primaryClass} disabled={copying} onClick={() => void copyToMyDecks()}>
          {copying ? t("decks.copyingDeck") : t("decks.copyToMyDecks")}
        </button>
      ) : session === "unknown" ? null : (
        <Link href={{ pathname: "/connexion", query: { next: pathname } }} rel="nofollow" className={primaryClass}>
          {t("decks.copyToMyDecksLogin")}
        </Link>
      )}
      <button type="button" className={buttonClass} disabled={!text} onClick={() => void copyText(text).then(setCopied)}>
        {t("decks.copyList")}
      </button>
      {copied != null ? (
        <span className={`text-xs ${copied ? "text-gain" : "text-danger"}`} aria-live="polite">
          {copied ? t("decks.copied") : t("decks.copyFailed")}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
