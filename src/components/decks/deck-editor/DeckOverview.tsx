"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { CardImage } from "@/components/CardImage";
import { colorDotClass } from "@/components/CardTile";
import { ValidityBadge, issueText, panelClass } from "@/components/decks/ui";
import { DECK_RULES, cardLabel, type DeckAnalysis } from "@/lib/deck-rules";
import { COLOR_ORDER } from "@/lib/reference-data";
import type { PrintingDTO } from "@/lib/types";

/** En-tête du deck : légalité, 3 emplacements de Legends, RAM par couleur et problèmes. */
export function DeckOverview({
  analysis,
  preview,
  onQuantity,
  onBrowseLegends,
  onPreview,
}: {
  analysis: DeckAnalysis;
  preview: Map<string, PrintingDTO>;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowseLegends: () => void;
  onPreview: (cardId: string, list: string[]) => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const sizeOk = analysis.mainCount >= DECK_RULES.minCards && analysis.mainCount <= DECK_RULES.maxCards;
  const colors = COLOR_ORDER.filter((color) => analysis.ramLimits[color] != null);
  const slots = Array.from({ length: Math.max(DECK_RULES.legends, analysis.legends.length) }, (_, position) => analysis.legends[position]);
  return (
    <section className={`${panelClass} flex flex-col gap-4 p-4`} aria-labelledby="deck-validation">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="deck-validation" className="hud-label">
            {t("decks.validation")}
          </h2>
          <p className="mt-1 font-mono text-3xl tabular-nums">
            <span className={sizeOk ? "text-gain" : "text-foreground"}>{fmt.int(analysis.mainCount)}</span>
            <span className="text-base text-muted">
              {" "}
              / {DECK_RULES.minCards}–{DECK_RULES.maxCards}
            </span>
          </p>
        </div>
        <ValidityBadge analysis={analysis} />
      </div>

      <div>
        <h3 className="hud-label mb-2">
          {t("decks.legends")} · {analysis.legendCount}/{DECK_RULES.legends}
        </h3>
        <ul className="grid grid-cols-3 gap-2">
          {slots.map((line, position) =>
            line ? (
              <li key={line.card.id} className="relative min-w-0">
                <button
                  type="button"
                  className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() => onPreview(line.card.id, analysis.legends.map((entry) => entry.card.id))}
                  aria-label={t("decks.viewCard", { name: cardLabel(line.card) })}
                >
                  {preview.get(line.card.id)?.imagePath ? (
                    <CardImage
                      src={preview.get(line.card.id)!.imagePath!}
                      alt=""
                      className="aspect-[63/88] w-full rounded-md bg-black object-contain"
                    />
                  ) : (
                    <span className="grid aspect-[63/88] w-full place-items-center rounded-md bg-black text-xs text-muted">N/A</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onQuantity(line.card.id, line.quantity - 1)}
                  className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-sm text-foreground hover:bg-danger"
                  aria-label={t("decks.removeOne", { name: cardLabel(line.card) })}
                >
                  ×
                </button>
                <p className="mt-1 truncate text-[12px]" title={cardLabel(line.card)}>
                  {line.card.name}
                </p>
              </li>
            ) : (
              <li key={`slot-${position}`} className="min-w-0">
                <button
                  type="button"
                  onClick={onBrowseLegends}
                  className="grid aspect-[63/88] w-full place-items-center rounded-md border border-dashed border-line text-xs text-muted transition hover:border-cyan hover:text-cyan"
                >
                  <span className="flex flex-col items-center gap-1">
                    <span className="text-2xl leading-none" aria-hidden="true">
                      +
                    </span>
                    Legend
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {colors.length > 0 ? (
          colors.map((color) => (
            <span key={color} className="inline-flex h-6 items-center gap-1.5 border border-line px-1.5 text-[12px]">
              <span className={`h-2 w-2 rounded-full ${colorDotClass(color)}`} aria-hidden="true" />
              {t("decks.ramLimit", { color, n: analysis.ramLimits[color] })}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-muted">{t("decks.noRam")}</span>
        )}
      </div>

      {analysis.issues.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-line/60 pt-3 text-xs text-danger">
          {analysis.issues.map((issue, position) => (
            <li key={`${issue.code}-${position}`} className="flex gap-2">
              <span aria-hidden="true">✕</span>
              {issueText(t, issue)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
