"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { colorDotClass } from "@/components/CardTile";
import { Stepper, panelClass, primaryClass } from "@/components/decks/ui";
import {
  DECK_RULES,
  cardLabel,
  isLegal,
  ramAllowed,
  type DeckAnalysis,
  type DeckLine,
  type ShortfallLine,
} from "@/lib/deck-rules";
import { TYPE_ORDER } from "@/lib/reference-data";
import type { CardDTO } from "@/lib/types";

/** Cartes du deck hors Legends, groupées par type, en lignes compactes. */
export function DeckCardList({
  analysis,
  lineByCard,
  canAdd,
  onQuantity,
  onBrowse,
  onPreview,
}: {
  analysis: DeckAnalysis;
  lineByCard: Map<string, ShortfallLine>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowse: () => void;
  onPreview: (cardId: string, list: string[]) => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  if (analysis.main.length === 0) {
    return (
      <div className={`${panelClass} flex flex-col items-start gap-3 p-4`}>
        <p className="text-sm text-muted">{t("decks.emptyDeck")}</p>
        <button type="button" className={`${primaryClass} lg:hidden`} onClick={onBrowse}>
          {t("decks.addCards")}
        </button>
      </div>
    );
  }
  const known = TYPE_ORDER as readonly string[];
  const groups = [
    ...TYPE_ORDER.filter((type) => type !== "Legend").map((type) => ({
      key: type,
      title: type,
      lines: analysis.main.filter((line) => line.card.cardType === type),
    })),
    { key: "other", title: t("decks.otherCards"), lines: analysis.main.filter((line) => !known.includes(line.card.cardType ?? "")) },
  ].filter((group) => group.lines.length > 0);
  return (
    <section className={panelClass} aria-label={t("decks.mainDeck")}>
      {groups.map((group) => (
        <div key={group.key} className="border-t border-line/60 first:border-t-0">
          <h3 className="hud-label flex justify-between px-3 pt-3 pb-1">
            <span>{group.title}</span>
            <span className="tabular-nums">{fmt.int(group.lines.reduce((sum, line) => sum + line.quantity, 0))}</span>
          </h3>
          <ul className="pb-1.5">
            {group.lines.map((line) => (
              <DeckRow
                key={line.card.id}
                line={line}
                detail={lineByCard.get(line.card.id)}
                ramOk={analysis.legends.length === 0 || ramAllowed(line.card, analysis.ramLimits)}
                canAdd={canAdd(line.card)}
                onQuantity={onQuantity}
                onPreview={() => onPreview(line.card.id, analysis.main.map((entry) => entry.card.id))}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function DeckRow({
  line,
  detail,
  ramOk,
  canAdd,
  onQuantity,
  onPreview,
}: {
  line: DeckLine;
  detail: ShortfallLine | undefined;
  ramOk: boolean;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onPreview: () => void;
}) {
  const t = useTranslations();
  const label = cardLabel(line.card);
  const owned = detail?.owned ?? 0;
  const ownedTone = owned >= line.quantity ? "bg-gain" : owned > 0 ? "bg-yellow" : "bg-line";
  const problem = !ramOk || !isLegal(line.card) || line.quantity > DECK_RULES.maxCopies;
  return (
    <li className={`flex items-center gap-2 px-3 py-1 hover:bg-panel-2 ${problem ? "text-danger" : ""}`}>
      <span className="w-4 shrink-0 text-right font-mono text-sm tabular-nums text-cyan">{line.quantity}</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${colorDotClass(line.card.color)}`} aria-hidden="true" />
      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 truncate text-left text-sm hover:text-cyan"
        title={label}
        aria-label={t("decks.viewCard", { name: label })}
      >
        {label}
      </button>
      <span className="w-5 shrink-0 text-center font-mono text-[12px] text-muted" title={line.card.cost != null ? t("decks.cost", { n: line.card.cost }) : undefined}>
        {line.card.cost ?? ""}
      </span>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${ownedTone}`}
        title={t("decks.ownedTitle", { owned, total: line.quantity })}
        aria-label={t("decks.ownedTitle", { owned, total: line.quantity })}
        role="img"
      />
      <Stepper card={line.card} quantity={line.quantity} canAdd={canAdd} onQuantity={onQuantity} compact />
    </li>
  );
}
