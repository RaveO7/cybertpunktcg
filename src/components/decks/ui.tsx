"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Translator } from "@/i18n/translator";
import { colorDotClass } from "@/components/CardTile";
import { useModal } from "@/components/use-modal";
import { cardLabel, isLegal, type DeckAnalysis, type DeckIssue } from "@/lib/deck-rules";
import type { CardDTO } from "@/lib/types";

export function BackLink() {
  const t = useTranslations();
  return (
    <Link href="/decks" className="inline-flex h-10 items-center gap-1.5 text-sm text-muted hover:text-cyan">
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 3 5 8l5 5" />
      </svg>
      {t("decks.back")}
    </Link>
  );
}

export const buttonClass =
  "inline-flex h-10 items-center justify-center gap-1.5 border border-line px-3 text-sm text-muted transition hover:border-cyan hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 disabled:opacity-50";
export const primaryClass =
  "inline-flex h-10 items-center justify-center bg-yellow px-4 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50";

/** Pop-up de confirmation avant de supprimer un deck. */
export function DeleteDeckDialog({
  name,
  pending,
  onConfirm,
  onCancel,
}: {
  name: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus sur « Annuler » à l'ouverture, retour à l'élément d'origine à la fermeture.
  useModal(overlayRef, { onClose: onCancel, initialFocus: cancelRef, closeOnEscape: !pending });

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col gap-4 border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-yellow">
          {t("decks.deleteTitle")}
        </h2>
        <p className="text-sm text-muted">{t("decks.deleteMessage", { name })}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className={buttonClass} onClick={onCancel}>
            {t("decks.cancel")}
          </button>
          <button
            type="button"
            className={`${buttonClass} border-danger text-danger hover:border-danger hover:text-danger`}
            disabled={pending}
            onClick={onConfirm}
          >
            {t("decks.confirmDelete")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PencilIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M11 2.5 13.5 5 6 12.5H3.5V10z" />
      <path d="m9.5 4 2.5 2.5" />
    </svg>
  );
}

export function ValidityBadge({ analysis }: { analysis: DeckAnalysis }) {
  const t = useTranslations();
  return analysis.valid ? (
    <span className="inline-flex h-6 shrink-0 items-center border border-gain/45 bg-gain/10 px-1.5 text-[11px] text-gain">
      {t("decks.valid")}
    </span>
  ) : (
    <span className="inline-flex h-6 shrink-0 items-center border border-danger/45 bg-danger/10 px-1.5 text-[11px] text-danger">
      {t("decks.issueCount", { n: analysis.issues.length })}
    </span>
  );
}

export function issueText(t: Translator, issue: DeckIssue) {
  switch (issue.code) {
    case "legend-count":
      return t("decks.issueLegendCount", { n: issue.count });
    case "legend-name":
      return t("decks.issueLegendName", { name: issue.name });
    case "deck-size":
      return t("decks.issueDeckSize", { n: issue.count });
    case "copies":
      return t("decks.issueCopies", { name: issue.name, n: issue.quantity });
    case "ram":
      return t("decks.issueRam", { name: issue.name, ram: issue.ram, color: issue.color, limit: issue.limit });
    case "not-legal":
      return t("decks.issueNotLegal", { name: issue.name });
    case "unknown":
      return t("decks.issueUnknown");
  }
}

export const panelClass = "border border-line bg-panel";

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gain" }) {
  return (
    <div className="flex min-w-0 flex-col justify-between border border-line bg-panel px-3 py-2.5">
      <p className="text-[10px] leading-tight tracking-[0.12em] text-muted uppercase">{label}</p>
      <div className="mt-1.5">
        <p className={`truncate text-lg ${tone === "gain" ? "text-gain" : "text-foreground"}`}>{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[10px] text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function CardFacts({ card, ramOk }: { card: CardDTO; ramOk: boolean }) {
  const t = useTranslations();
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
        {card.color ?? "—"}
      </span>
      {card.cost != null ? <span>{t("decks.cost", { n: card.cost })}</span> : null}
      {card.ram != null ? <span className={ramOk ? "" : "text-danger"}>{t("decks.ram", { n: card.ram })}</span> : null}
      {!isLegal(card) ? <span className="text-danger">{t("decks.notLegal")}</span> : null}
    </span>
  );
}

export function Stepper({
  card,
  quantity,
  canAdd,
  onQuantity,
  wide = false,
  compact = false,
}: {
  card: CardDTO;
  quantity: number;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  wide?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations();
  const label = cardLabel(card);
  const size = compact ? "h-7 w-7 text-sm" : "h-9 w-9 text-base";
  const step = `grid ${size} place-items-center border border-line text-muted hover:border-cyan hover:text-foreground disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted`;
  return (
    <span className={wide ? "flex w-full items-center justify-between" : "flex shrink-0 items-center"}>
      <button type="button" className={step} disabled={quantity <= 0} onClick={() => onQuantity(card.id, quantity - 1)} aria-label={t("decks.removeOne", { name: label })}>
        −
      </button>
      {compact ? null : (
        <span className="w-8 text-center font-mono text-sm tabular-nums" aria-label={t("decks.inDeck", { n: quantity })}>
          {quantity}
        </span>
      )}
      <button
        type="button"
        className={`${step} ${compact ? "-ml-px" : ""}`}
        disabled={!canAdd}
        onClick={() => onQuantity(card.id, quantity + 1)}
        aria-label={t("decks.addOne", { name: label })}
      >
        +
      </button>
    </span>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
