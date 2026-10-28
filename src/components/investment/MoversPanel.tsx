"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { formatSignedMoney, formatSignedPercent } from "@/components/TrendBadge";
import type { InvestmentMover, ValueConcentration } from "@/lib/logic";

/**
 * Plus fortes hausses et baisses de valeur sur la durée choisie (euros, quantité comprise), et concentration
 * du portefeuille : part de la valeur des cartes les plus chères. Porte sur les cartes du détail (filtres).
 */
export function MoversPanel({
  gainers,
  losers,
  concentration,
  hint,
  openCard,
}: {
  gainers: InvestmentMover[];
  losers: InvestmentMover[];
  concentration: ValueConcentration | null;
  /** Durée des variations (« Sur 1 mois : … »). */
  hint: string;
  openCard: (printingId: string) => void;
}) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  return (
    <section>
      <h2 className="mb-1 text-lg">{t("investment.movers.title")}</h2>
      <p className="mb-3 text-xs text-muted sm:text-sm">{hint}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <MoverList title={t("investment.movers.gainers")} movers={gainers} empty={t("investment.movers.empty")} openCard={openCard} />
        <MoverList title={t("investment.movers.losers")} movers={losers} empty={t("investment.movers.empty")} openCard={openCard} />
        <div className="min-w-0 border border-line bg-panel px-3 py-3">
          <h3 className="text-[11px] tracking-[0.12em] text-muted uppercase sm:text-xs">{t("investment.movers.concentration")}</h3>
          {concentration ? (
            <>
              <p className="mt-2 text-sm">
                {t("investment.movers.concentrationTop", {
                  n: concentration.topCount,
                  share: fmt.percent(concentration.topShare * 100),
                })}
              </p>
              <ol className="mt-3 flex flex-col gap-2">
                {concentration.largest.map(({ position, share }) => (
                  <li key={position.printingId} className="min-w-0 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardName title={position.title} onOpen={() => openCard(position.printingId)} />
                      <span className="shrink-0 font-mono text-muted">{fmt.percent(share * 100)}</span>
                    </div>
                    {/* Jauge : la longueur porte la part, le pourcentage reste écrit à côté. */}
                    <span aria-hidden className="mt-1 block h-1.5 w-full rounded-full bg-line/60">
                      <span className="block h-full rounded-full bg-cyan" style={{ width: `${Math.max(share * 100, 1)}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">—</p>
          )}
        </div>
      </div>
    </section>
  );
}

function MoverList({
  title,
  movers,
  empty,
  openCard,
}: {
  title: string;
  movers: InvestmentMover[];
  empty: string;
  openCard: (printingId: string) => void;
}) {
  const fmt = useNumberFormat();
  return (
    <div className="min-w-0 border border-line bg-panel px-3 py-3">
      <h3 className="text-[11px] tracking-[0.12em] text-muted uppercase sm:text-xs">{title}</h3>
      {movers.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5">
          {movers.map(({ position, amount, percent }) => (
            <li key={position.printingId} className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0">
                <CardName title={position.title} onOpen={() => openCard(position.printingId)} />
                <span className="block truncate text-xs text-muted">
                  {position.setName}
                  {position.quantity > 1 ? ` · ×${position.quantity}` : ""}
                </span>
              </span>
              <span className={`shrink-0 text-right font-mono ${amount > 0 ? "text-gain" : "text-danger"}`}>
                {formatSignedMoney(fmt, amount)}
                {percent != null ? <span className="block text-xs opacity-80">{formatSignedPercent(fmt, percent)}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CardName({ title, onOpen }: { title: string; onOpen: () => void }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      title={t("investment.openCard", { name: title })}
      onClick={onOpen}
      className="block max-w-full truncate text-left underline-offset-2 hover:text-cyan hover:underline"
    >
      {title}
    </button>
  );
}
