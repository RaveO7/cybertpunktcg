"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { colorDotClass } from "@/components/CardTile";
import { RulesText } from "@/components/RulesText";
import type { useDeckCatalog } from "@/components/decks/hooks";
import { Stepper, primaryClass } from "@/components/decks/ui";
import { useModal } from "@/components/use-modal";
import { cardLabel, cheapestPrinting, isLegal, isLegend, ramAllowed, type DeckAnalysis } from "@/lib/deck-rules";
import { resolveRulesText } from "@/lib/logic";
import type { CardDTO } from "@/lib/types";

/**
 * Aperçu d'une carte avant de l'ajouter : grande image, caractéristiques, texte de règles,
 * possession et prix. Flèches (boutons ou clavier) pour passer à la carte voisine de la liste.
 */
export function CardPreview({
  card,
  list,
  index,
  quantity,
  owned,
  analysis,
  blockReason,
  onNavigate,
  onQuantity,
  onClose,
}: {
  card: CardDTO;
  list: string[];
  index: ReturnType<typeof useDeckCatalog>;
  quantity: number;
  owned: number;
  analysis: DeckAnalysis;
  blockReason: string | null;
  onNavigate: (cardId: string) => void;
  onQuantity: (cardId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const locale = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `deck-preview-${card.id}`;
  const position = list.indexOf(card.id);
  const prevId = position > 0 ? list[position - 1] : null;
  const nextId = position >= 0 && position < list.length - 1 ? list[position + 1] : null;
  const printing = index.preview.get(card.id);
  const printings = index.printingsByCard.get(card.id) ?? [];
  const rules = printing
    ? resolveRulesText(card, printing, printings.filter((entry) => entry.id !== printing.id), locale).text
    : (card.rulesText ?? "");
  const cheapest = cheapestPrinting(printings);
  const hasLegends = analysis.legends.length > 0;
  const ramOk = isLegend(card) || !hasLegends || ramAllowed(card, analysis.ramLimits);
  const label = cardLabel(card);

  const overlayRef = useRef<HTMLDivElement>(null);
  // Focus sur « Fermer » à l'ouverture, retour à l'élément d'origine à la fermeture.
  useModal(overlayRef, { onClose, initialFocus: closeRef });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && prevId) onNavigate(prevId);
      else if (event.key === "ArrowRight" && nextId) onNavigate(nextId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate, prevId, nextId]);

  const stats = [
    { label: t("filters.cost"), value: card.cost },
    { label: t("filters.power"), value: card.power },
    { label: t("filters.ram"), value: card.ram, danger: !ramOk },
  ].filter((stat) => stat.value != null);
  const navButton =
    "grid h-10 w-10 place-items-center border border-line text-muted hover:border-cyan hover:text-foreground disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-x-0 top-0 bottom-[var(--app-bottom-nav)] z-50 overflow-y-auto overscroll-contain bg-black/80 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="px-safe pt-safe mx-auto flex min-h-full w-full flex-col bg-panel sm:min-h-0 sm:max-w-4xl sm:border sm:border-line sm:shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-panel px-4 py-3 sm:static sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-xl font-bold text-yellow sm:text-2xl">
              {card.name}
            </h2>
            {card.subname ? <p className="truncate text-sm text-muted">{card.subname}</p> : null}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className={navButton} aria-label={t("decks.close")}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3">
            {printing?.imagePath ? (
              // Image d'origine (pas la miniature) : le texte de la carte doit rester lisible.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={printing.imagePath} alt={label} className="w-full max-w-[19rem] rounded-xl bg-black object-contain" />
            ) : (
              <span className="grid aspect-[63/88] w-full max-w-[19rem] place-items-center rounded-xl bg-black text-sm text-muted">N/A</span>
            )}
            {list.length > 1 ? (
              <div className="flex items-center gap-3">
                <button type="button" className={navButton} disabled={!prevId} onClick={() => prevId && onNavigate(prevId)} aria-label={t("decks.previousCard")}>
                  ‹
                </button>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {fmt.int(position + 1)} / {fmt.int(list.length)}
                </span>
                <button type="button" className={navButton} disabled={!nextId} onClick={() => nextId && onNavigate(nextId)} aria-label={t("decks.nextCard")}>
                  ›
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex h-6 items-center gap-1.5 border border-line px-2">
                <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
                {card.color ?? "—"}
              </span>
              {card.cardType ? <span className="inline-flex h-6 items-center border border-line px-2">{card.cardType}</span> : null}
              {card.tags.map((tag) => (
                <span key={tag} className="inline-flex h-6 items-center border border-line px-2 font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
                  {tag}
                </span>
              ))}
            </div>

            {stats.length > 0 ? (
              <dl className="grid grid-cols-3 gap-2">
                {stats.map((stat) => (
                  <div key={stat.label} className={`border px-3 py-2 ${stat.danger ? "border-danger/60" : "border-line"}`}>
                    <dt className="hud-label">{stat.label}</dt>
                    <dd className={`mt-1 font-mono text-xl tabular-nums ${stat.danger ? "text-danger" : "text-cyan"}`}>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {rules.trim() ? <RulesText label={t("modal.rulesText")} text={rules} compact /> : null}
            {card.flavorText ? <p className="text-sm text-muted italic">{card.flavorText}</p> : null}

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className={owned > 0 ? "text-gain" : "text-muted"}>{owned > 0 ? t("decks.ownedCount", { n: owned }) : t("decks.notOwned")}</span>
              <span className="text-muted">{cheapest ? t("decks.fromPrice", { amount: fmt.money(cheapest.price) }) : t("decks.noPrice")}</span>
            </div>

            {!isLegal(card) || !ramOk ? (
              <ul className="flex flex-col gap-1 text-sm text-danger">
                {!isLegal(card) ? <li>{t("decks.issueNotLegal", { name: label })}</li> : null}
                {!ramOk && card.color && card.ram != null ? (
                  <li>{t("decks.issueRam", { name: label, ram: card.ram, color: card.color, limit: analysis.ramLimits[card.color] ?? 0 })}</li>
                ) : null}
              </ul>
            ) : null}

            {/* Téléphone : action toujours visible en bas de l'aperçu. */}
            <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-line/60 bg-panel px-4 pt-3 pb-4 sm:static sm:mx-0 sm:px-0 sm:pt-4 sm:pb-0">
              {quantity > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-cyan">{t("decks.inDeck", { n: quantity })}</span>
                  <span className="ml-auto w-44">
                    <Stepper card={card} quantity={quantity} canAdd={blockReason === null} onQuantity={onQuantity} wide />
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${primaryClass} h-11 w-full`}
                  disabled={blockReason !== null}
                  onClick={() => {
                    // Ajout fait : retour direct à la liste, sans clic de fermeture en plus.
                    onQuantity(card.id, 1);
                    onClose();
                  }}
                >
                  {t("decks.addToDeck")}
                </button>
              )}
              {blockReason ? <p className="text-xs text-muted">{blockReason}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
