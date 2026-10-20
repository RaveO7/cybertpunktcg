"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass, copyText, primaryClass } from "@/components/decks/ui";
import { deckToText, parseDeckText, type DeckEntry, type DeckLine } from "@/lib/deck-rules";
import type { CardDTO } from "@/lib/types";

export function ExportPanel({ lines, onClose }: { lines: DeckLine[]; onClose: () => void }) {
  const t = useTranslations();
  const [copied, setCopied] = useState<boolean | null>(null);
  const text = deckToText(lines);
  return (
    <section className="flex flex-col gap-2 border border-line bg-panel p-3 sm:p-4" aria-label={t("decks.export")}>
      <textarea
        readOnly
        value={text}
        rows={Math.min(12, Math.max(3, lines.length))}
        className="w-full resize-y border border-line bg-background p-2 font-mono text-xs outline-none focus:border-cyan"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex items-center gap-2">
        <button type="button" className={primaryClass} disabled={!text} onClick={() => void copyText(text).then(setCopied)}>
          {t("decks.copyList")}
        </button>
        <button type="button" className={buttonClass} onClick={onClose}>
          {t("decks.close")}
        </button>
        {copied != null ? (
          <span className={`text-xs ${copied ? "text-gain" : "text-danger"}`} aria-live="polite">
            {copied ? t("decks.copied") : t("decks.copyFailed")}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function ImportPanel({ cards, onApply, onClose }: { cards: CardDTO[]; onApply: (entries: DeckEntry[]) => void; onClose: () => void }) {
  const t = useTranslations();
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseDeckText(text, cards) : null), [text, cards]);
  return (
    <section className="flex flex-col gap-2 border border-line bg-panel p-3 sm:p-4" aria-labelledby="deck-import">
      <h2 id="deck-import" className="hud-label">
        {t("decks.importTitle")}
      </h2>
      <p className="text-xs text-muted">{t("decks.importHint")}</p>
      <textarea
        value={text}
        rows={8}
        placeholder={"3 V: Streetkid\n3 Japantown Jonin"}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y border border-line bg-background p-2 font-mono text-xs outline-none focus:border-cyan"
      />
      {parsed && parsed.unmatched.length > 0 ? (
        <div className="text-xs text-danger" role="status">
          <p>{t("decks.importUnmatched", { n: parsed.unmatched.length })}</p>
          <ul className="mt-1 list-inside list-disc font-mono">
            {parsed.unmatched.slice(0, 8).map((line, position) => (
              <li key={position}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primaryClass}
          disabled={!parsed || parsed.entries.length === 0}
          onClick={() => parsed && onApply(parsed.entries)}
        >
          {parsed ? t("decks.importApply", { n: parsed.entries.reduce((sum, entry) => sum + entry.quantity, 0) }) : t("decks.importApply", { n: 0 })}
        </button>
        <button type="button" className={buttonClass} onClick={onClose}>
          {t("decks.cancel")}
        </button>
      </div>
    </section>
  );
}
