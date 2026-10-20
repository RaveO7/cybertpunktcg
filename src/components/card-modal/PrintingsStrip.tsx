"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { CardImage } from "@/components/CardImage";
import { toAmount } from "@/components/card-modal/shared";
import { baseCollectorNumber } from "@/lib/logic";
import type { PrintingDTO } from "@/lib/types";

/** Bandeau des impressions de la carte, avec prix et pastille « possédée ». */
export function PrintingsStrip({
  printing,
  siblings,
  ownedIds,
  titleId,
  onOpen,
}: {
  printing: PrintingDTO;
  siblings: PrintingDTO[];
  ownedIds: Set<string>;
  titleId: string;
  onOpen: (id: string) => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();

  // Selected printing first, then the same artwork (same number across beta/retail/languages,
  // then same artist and rarity), then the other printings.
  const appearanceRank = (entry: PrintingDTO) => {
    if (entry.id === printing.id) return 0;
    if (baseCollectorNumber(entry.collectorNumber) === baseCollectorNumber(printing.collectorNumber)) return 1;
    if (entry.artist && entry.artist === printing.artist && entry.rarity === printing.rarity) return 2;
    return 3;
  };
  const allPrintings = [...siblings, printing].sort(
    (a, b) =>
      appearanceRank(a) - appearanceRank(b) ||
      a.setName.localeCompare(b.setName, "fr") ||
      a.collectorNumber.localeCompare(b.collectorNumber, "fr", { numeric: true }),
  );

  if (siblings.length === 0) return null;
  return (
    <section aria-labelledby={`${titleId}-printings`} className="order-9 flex min-w-0 flex-col gap-3 md:order-none">
      <h3 id={`${titleId}-printings`} className="hud-label text-muted">
        {t("modal.printings")} · {allPrintings.length}
      </h3>
      <ul data-no-swipe="" className="scrollbar-hud -mx-4 flex gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        {allPrintings.map((entry) => {
          const label = `#${entry.collectorNumber} · ${entry.setName}`;
          const current = entry.id === printing.id;
          const owned = ownedIds.has(entry.id);
          const entryPrice = toAmount(entry.marketPrice);
          return (
            <li key={entry.id} className="w-[66px] shrink-0 md:w-[74px]">
              <button
                type="button"
                className={`group relative block w-full border text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 ${
                  current
                    ? "border-yellow bg-yellow/5 ring-1 ring-yellow"
                    : "border-line/80 hover:border-cyan/60"
                }`}
                onClick={() => !current && onOpen(entry.id)}
                aria-current={current ? "true" : undefined}
                aria-label={current ? t("modal.currentPrinting", { label }) : t("modal.openPrinting", { label })}
                title={label}
              >
                {entry.imagePath ? (
                  <CardImage
                    src={entry.imagePath}
                    alt=""
                    loading="lazy"
                    className="aspect-[63/88] w-full bg-black object-cover"
                  />
                ) : (
                  <span
                    className="flex aspect-[63/88] w-full items-center justify-center bg-background text-[9px] text-muted"
                    aria-hidden="true"
                  >
                    —
                  </span>
                )}
                {owned ? (
                  <span
                    className="absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center bg-yellow text-black"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 16 16" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                  </span>
                ) : null}
                <span
                  className={`flex items-center justify-between gap-1 px-1.5 py-1 font-mono text-[10px] tabular-nums ${
                    current ? "text-yellow" : "text-muted group-hover:text-cyan"
                  }`}
                >
                  <span className="truncate">{entry.collectorNumber}</span>
                  <span className={`shrink-0 ${!current && entryPrice != null ? "text-foreground/80" : ""}`}>
                    {entryPrice != null ? fmt.money(entryPrice) : "—"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
