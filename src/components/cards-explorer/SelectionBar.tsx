"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";

/** Barre d'actions du mode ajout, au-dessus de la barre d'onglets : sélection en cours, annuler, ajouter. */
export function SelectionBar({
  filtersVisibility,
  draftCopies,
  draftCards,
  addError,
  rangeAnchor,
  adding,
  onClear,
  onCommit,
}: {
  filtersVisibility: "auto" | "open" | "closed";
  draftCopies: number;
  draftCards: number;
  addError: string | null;
  rangeAnchor: string | null;
  adding: boolean;
  onClear: () => void;
  onCommit: () => Promise<void>;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  return (

    <div className="fixed inset-x-0 bottom-[var(--app-bottom-nav)] z-30 border-t border-yellow/60 bg-background/95 px-4 pt-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-var(--app-bottom-nav)))] backdrop-blur">
      <div
        className={`mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
          filtersVisibility === "closed" ? "max-w-[80rem]" : "max-w-[1600px]"
        }`}
      >
        <div>
          <p className="font-medium">
            {draftCopies === 0
              ? t("cards.noneSelected")
              : t("cards.selectionSummary", { copies: fmt.int(draftCopies), copyNoun: t("common.copies", { n: draftCopies }), cards: fmt.int(draftCards), cardNoun: t("common.cards", { n: draftCards }) })}
          </p>
          {addError ? <p className="text-sm text-danger">{addError}</p> : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-11 shrink-0 whitespace-nowrap border border-line px-3 text-sm disabled:opacity-40 sm:px-4"
            onClick={onClear}
            disabled={(draftCards === 0 && !rangeAnchor) || adding}
          >
            {t("cards.cancelSelection")}
          </button>
          <button
            type="button"
            className="h-11 min-w-0 flex-1 truncate bg-yellow px-3 text-sm font-semibold text-black disabled:opacity-50 sm:flex-none sm:px-4 sm:text-base"
            disabled={draftCards === 0 || adding}
            onClick={() => void onCommit()}
          >
            {adding ? t("cards.adding") : t("cards.addSelection")}
          </button>
        </div>
      </div>
    </div>
  );
}
