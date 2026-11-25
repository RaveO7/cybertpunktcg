"use client";

import { useTranslations } from "next-intl";
import { panelClass } from "@/components/decks/ui";

export function CostCurve({ curve }: { curve: number[] }) {
  const t = useTranslations();
  const max = Math.max(1, ...curve);
  return (
    <section className={`${panelClass} p-4`} aria-labelledby="deck-curve">
      <h2 id="deck-curve" className="hud-label">
        {t("decks.curve")}
      </h2>
      <ol className="mt-3 grid h-24 grid-cols-8 items-end gap-1.5">
        {curve.map((count, cost) => (
          <li key={cost} className="flex h-full flex-col items-center justify-end gap-1" aria-label={t("decks.curveBar", { cost: cost === 7 ? "7+" : String(cost), n: count })}>
            <span className="font-mono text-[10px] tabular-nums text-muted">{count || ""}</span>
            <span className="w-full bg-cyan/70" style={{ height: `${(count / max) * 65}%`, minHeight: count ? 2 : 0 }} />
            <span className="font-mono text-[12px] text-muted">{cost === 7 ? "7+" : cost}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
