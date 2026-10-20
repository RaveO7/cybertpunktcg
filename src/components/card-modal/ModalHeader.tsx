"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import type { CardDTO, PrintingDTO } from "@/lib/types";

const headerBtnClass =
  "grid h-11 w-11 place-items-center border border-line text-foreground transition hover:border-yellow/50 hover:text-yellow disabled:cursor-default disabled:opacity-30 disabled:hover:border-line disabled:hover:text-foreground focus-visible:border-yellow/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow/70";

/** En-tête de la fiche : nom de la carte, carte précédente / suivante et fermeture. */
export function ModalHeader({
  card,
  printing,
  title,
  titleId,
  prevId,
  nextId,
  closeRef,
  onOpen,
  onClose,
}: {
  card: CardDTO;
  printing: PrintingDTO;
  title: string;
  titleId: string;
  prevId?: string | null;
  nextId?: string | null;
  closeRef: RefObject<HTMLButtonElement | null>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5 sm:static sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0 flex-1">
        <h2
          id={titleId}
          className="truncate text-xl font-bold leading-tight tracking-[-0.02em] text-yellow sm:text-[2rem]"
        >
          {card.subname && !printing.localizedName ? (
            <>
              {card.name} <span className="font-normal text-foreground">{card.subname}</span>
            </>
          ) : (
            title
          )}
        </h2>
      </div>
      {(prevId || nextId) && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={headerBtnClass}
            onClick={() => prevId && onOpen(prevId)}
            disabled={!prevId}
            aria-label={t("modal.previousCard")}
            title={t("modal.previousCard")}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="square" />
            </svg>
          </button>
          <button
            type="button"
            className={headerBtnClass}
            onClick={() => nextId && onOpen(nextId)}
            disabled={!nextId}
            aria-label={t("modal.nextCard")}
            title={t("modal.nextCard")}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      )}
      <button
        ref={closeRef}
        type="button"
        className={`${headerBtnClass} shrink-0`}
        onClick={onClose}
        aria-label={t("modal.close")}
        title={t("modal.close")}
      >
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
      </button>
    </header>
  );
}
