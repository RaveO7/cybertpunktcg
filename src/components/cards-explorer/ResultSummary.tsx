"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";

type PriceTotal = { total: number; unpriced: number };

/** Nombre de cartes de la liste, valeur de la liste (ou des cartes manquantes) et valeur de la sélection. */
export function ResultSummary({
  count,
  listPrice,
  missingList,
  selectionPrice,
}: {
  count: number;
  listPrice: PriceTotal | null;
  missingList: boolean;
  selectionPrice: PriceTotal | null;
}) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
      <p role="status">
        {count === 0
          ? t("cards.noCards")
          : t("cards.cardCount", { count: fmt.int(count), noun: t("common.cards", { n: count }) })}
      </p>
      {listPrice && count > 0 ? (
        <p className="font-mono text-yellow">
          {listPrice.unpriced > 0
            ? t(missingList ? "cards.missingTotalPartial" : "cards.listTotalPartial", { total: fmt.money(listPrice.total), unpriced: fmt.int(listPrice.unpriced) })
            : t(missingList ? "cards.missingTotal" : "cards.listTotal", { total: fmt.money(listPrice.total) })}
        </p>
      ) : null}
      {selectionPrice ? (
        <p className="font-mono text-cyan" aria-live="polite">
          {selectionPrice.unpriced > 0
            ? t("cards.selectionTotalPartial", { total: fmt.money(selectionPrice.total), unpriced: fmt.int(selectionPrice.unpriced) })
            : t("cards.selectionTotal", { total: fmt.money(selectionPrice.total) })}
        </p>
      ) : null}
    </div>
  );
}
