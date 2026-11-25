"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useModal } from "@/components/use-modal";

/** Confirmation avant de quitter le mode ajout avec une sélection non enregistrée. */
export function LeaveAddModeDialog({
  cardCount,
  onStay,
  onLeave,
}: {
  cardCount: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  useModal(dialogRef, { onClose: onStay, initialFocus: stayRef });
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-add-mode-title"
    >
      <div className="w-full max-w-md border border-yellow bg-panel p-5">
        <h2 id="leave-add-mode-title" className="text-lg text-yellow">
          {t("cards.leaveTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t("cards.leaveBody", { count: fmt.int(cardCount), noun: t("common.cards", { n: cardCount }) })}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={stayRef} type="button" className="h-10 border border-line px-4 text-sm" onClick={onStay}>
            {t("cards.stay")}
          </button>
          <button type="button" className="h-10 bg-yellow px-4 text-sm font-semibold text-black" onClick={onLeave}>
            {t("cards.leave")}
          </button>
        </div>
      </div>
    </div>
  );
}
