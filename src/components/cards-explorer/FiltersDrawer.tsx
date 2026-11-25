"use client";

import { useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useModal } from "@/components/use-modal";

/**
 * Colonne de filtres sur bureau, tiroir plein écran sur téléphone et tablette (modale quand il est ouvert).
 * `collapsed` : colonne de bureau repliée par l'utilisateur.
 */
export function FiltersDrawer({
  open,
  collapsed,
  resultCount,
  onClose,
  children,
}: {
  open: boolean;
  collapsed: boolean;
  resultCount: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const drawerRef = useRef<HTMLDivElement>(null);
  useModal(drawerRef, { open, onClose });
  return (
    <div
      ref={drawerRef}
      className={`${
        open ? "fixed inset-0 z-50 bg-black/70 lg:static lg:z-auto lg:bg-transparent" : "hidden"
      } ${collapsed ? "lg:hidden" : "lg:block"}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="pt-safe flex h-full w-[min(22rem,88vw)] flex-col border-r border-line bg-background lg:sticky lg:top-0 lg:block lg:h-auto lg:max-h-[100cqh] lg:w-auto lg:overflow-auto lg:border-0 lg:bg-transparent lg:pt-0 lg:pb-4 lg:pr-4 scrollbar-hud"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? t("cards.filters") : undefined}
      >
        <div className="scrollbar-hud min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:overflow-visible lg:p-0">
          {children}
        </div>
        <div className="pb-safe shrink-0 border-t border-line bg-panel lg:hidden">
          <div className="p-3">
            <button
              type="button"
              className="h-11 w-full bg-yellow px-4 text-sm font-semibold text-black"
              onClick={onClose}
            >
              {resultCount === 0
                ? t("cards.noCards")
                : t("cards.cardCount", { count: fmt.int(resultCount), noun: t("common.cards", { n: resultCount }) })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
