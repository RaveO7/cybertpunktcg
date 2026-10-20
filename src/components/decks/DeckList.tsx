"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { Link, useRouter } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { CardImage } from "@/components/CardImage";
import { colorDotClass } from "@/components/CardTile";
import { useCollection } from "@/components/CollectionProvider";
import { useDeckCatalog } from "@/components/decks/hooks";
import { DeleteDeckDialog, PencilIcon, ValidityBadge, buttonClass, primaryClass } from "@/components/decks/ui";
import {
  DECK_RULES,
  analyzeDeck,
  deckShortfall,
  ownedCopiesByCard,
  type DeckAnalysis,
  type DeckEntry,
  type Shortfall,
} from "@/lib/deck-rules";
import type { CatalogDTO, DeckDTO, PrintingDTO } from "@/lib/types";

export function DeckList({
  decks,
  catalog,
  onCreate,
  onDelete,
}: {
  decks: DeckDTO[];
  catalog: CatalogDTO;
  onCreate: (input: { name?: string; cards?: DeckEntry[] }) => Promise<DeckDTO>;
  onDelete: (id: string) => Promise<void>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { items } = useCollection();
  const { cardsById, printingsByCard, preview } = useDeckCatalog(catalog);
  const owned = useMemo(() => ownedCopiesByCard(items, catalog.printings), [items, catalog.printings]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" });

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("decks.failed"));
    } finally {
      setPending(false);
    }
  }

  const create = () =>
    run(async () => {
      const deck = await onCreate({ name: t("decks.defaultName") });
      router.push({ pathname: "/decks", query: { deck: deck.id } });
    });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-5 px-3 pt-4 pb-24 sm:gap-6 sm:px-4 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-yellow sm:text-4xl">{t("decks.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("decks.subtitle")}</p>
        </div>
        {/* Mobile : flottant au centre, juste au-dessus de la barre d'onglets, pour le pouce. */}
        <button
          type="button"
          className="fixed bottom-[calc(var(--app-bottom-nav)+1rem)] left-1/2 z-30 inline-flex h-12 -translate-x-1/2 items-center justify-center bg-yellow px-6 text-sm font-semibold text-black shadow-lg shadow-black/50 hover:brightness-110 disabled:opacity-50 sm:static sm:h-10 sm:translate-x-0 sm:px-4 sm:shadow-none"
          disabled={pending}
          onClick={() => void create()}
        >
          {t("decks.newDeck")}
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}

      {decks.length === 0 ? (
        <p className="border border-line bg-panel p-5 text-sm text-muted">{t("decks.empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const analysis = analyzeDeck(deck.cards, cardsById);
            const shortfall = deckShortfall([...analysis.legends, ...analysis.main], printingsByCard, owned);
            return (
              <DeckSummaryCard
                key={deck.id}
                deck={deck}
                analysis={analysis}
                shortfall={shortfall}
                preview={preview}
                updated={dateFormat.format(new Date(deck.updatedAt))}
                pending={pending}
                onDuplicate={() =>
                  void run(async () => {
                    await onCreate({ name: t("decks.copyName", { name: deck.name }).slice(0, 60), cards: deck.cards });
                  })
                }
                onDelete={() => void run(() => onDelete(deck.id))}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Carte d'un deck dans la liste : toute la carte ouvre l'éditeur (lien étiré « Modifier »). */
function DeckSummaryCard({
  deck,
  analysis,
  shortfall,
  preview,
  updated,
  pending,
  onDuplicate,
  onDelete,
}: {
  deck: DeckDTO;
  analysis: DeckAnalysis;
  shortfall: Shortfall;
  preview: Map<string, PrintingDTO>;
  updated: string;
  pending: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const slots = Array.from({ length: DECK_RULES.legends }, (_, position) => analysis.legends[position]);
  const secondary = `${buttonClass} relative z-10 h-9 px-3 text-xs`;
  return (
    <li className="group relative flex flex-col overflow-hidden border border-line bg-panel transition hover:border-cyan active:bg-panel-2">
      <div className="grid grid-cols-3 gap-1.5 p-3 pb-0" aria-hidden="true">
        {slots.map((line, position) => {
          const image = line ? preview.get(line.card.id)?.imagePath : null;
          return image ? (
            <CardImage
              key={line!.card.id}
              src={image}
              alt=""
              loading="lazy"
              className="aspect-[63/52] w-full rounded-md bg-black object-cover object-top"
            />
          ) : (
            <span
              key={`slot-${position}`}
              className="grid aspect-[63/52] w-full place-items-center rounded-md border border-dashed border-line text-[10px] text-muted"
            >
              Legend
            </span>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-1.5 text-lg text-foreground group-hover:text-cyan">
            <span className="truncate">{deck.name}</span>
            <PencilIcon className="h-4 w-4 shrink-0 text-muted group-hover:text-cyan" />
          </h2>
          <ValidityBadge analysis={analysis} />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {analysis.legends.length > 0 ? (
            analysis.legends.map(({ card }) => (
              <span key={card.id} className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
                {card.name}
              </span>
            ))
          ) : (
            <span>{t("decks.noLegends")}</span>
          )}
        </p>
        <dl className="grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-xs">
          <div>
            <dt className="hud-label">{t("decks.mainDeck")}</dt>
            <dd className="mt-1 font-mono tabular-nums">{fmt.int(analysis.mainCount)}</dd>
          </div>
          <div>
            <dt className="hud-label">{t("decks.owned")}</dt>
            <dd className="mt-1 font-mono tabular-nums">
              {fmt.int(shortfall.ownedCopies)}/{fmt.int(shortfall.totalCopies)}
            </dd>
          </div>
          <div>
            <dt className="hud-label">{t("decks.toBuy")}</dt>
            <dd className={`mt-1 font-mono tabular-nums ${shortfall.missingCopies === 0 && shortfall.totalCopies > 0 ? "text-gain" : ""}`}>
              {shortfall.missingCopies === 0 ? "—" : fmt.money(shortfall.missingCost)}
            </dd>
          </div>
        </dl>
        <p className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span>{t("decks.updated", { date: updated })}</span>
          {shortfall.totalCopies > 0 ? (
            <span className={`font-semibold ${shortfall.missingCopies === 0 ? "text-gain" : "text-yellow"}`}>
              {shortfall.missingCopies === 0 ? t("decks.complete") : t("decks.missingCount", { n: shortfall.missingCopies })}
            </span>
          ) : null}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {/* Lien étiré : son ::after couvre toute la carte, les autres boutons passent au-dessus (z-10). */}
          <Link
            href={{ pathname: "/decks", query: { deck: deck.id } }}
            aria-label={t("decks.open", { name: deck.name })}
            className={`${primaryClass} h-9 flex-1 gap-1.5 after:absolute after:inset-0 after:content-['']`}
          >
            {t("decks.edit")}
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h9M8.5 4 12.5 8l-4 4" />
            </svg>
          </Link>
          <button type="button" className={secondary} disabled={pending} onClick={onDuplicate}>
            {t("decks.duplicate")}
          </button>
          <button type="button" className={secondary} disabled={pending} onClick={() => setConfirming(true)}>
            {t("decks.delete")}
          </button>
          {confirming ? (
            <DeleteDeckDialog
              name={deck.name}
              pending={pending}
              onConfirm={() => {
                setConfirming(false);
                onDelete();
              }}
              onCancel={() => setConfirming(false)}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}
