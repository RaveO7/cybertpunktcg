"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCachedJson } from "@/components/data-cache";
import { buttonClass, copyText, primaryClass } from "@/components/decks/ui";
import { sendJson, useRequestErrors } from "@/components/send-json";
import type { DeckShareInfo } from "@/lib/deck-share";

/** Lien de partage d'un deck : créer, copier, renouveler (nouveau jeton) et révoquer. */
export function ShareDeckPanel({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const t = useTranslations();
  const errors = useRequestErrors();
  const url = `/api/decks/${encodeURIComponent(deckId)}/share`;
  const { data: share, error: loadError, mutate, retry } = useCachedJson<DeckShareInfo>(url);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(init: RequestInit, done: (next: DeckShareInfo) => string | null) {
    setBusy(true);
    setNote(null);
    try {
      const next = await sendJson<DeckShareInfo>(url, init, errors);
      mutate(() => next);
      const text = done(next);
      if (text) setNote({ text, ok: true });
    } catch (failure) {
      setNote({ text: failure instanceof Error ? failure.message : errors("saveFailed"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-line bg-panel p-3 sm:p-4" aria-label={t("decks.shareTitle")}>
      <h2 className="hud-label">{t("decks.shareTitle")}</h2>
      <p className="text-sm text-muted">{t("decks.shareHint")}</p>
      {share === undefined ? (
        loadError ? (
          <p className="flex items-center gap-2 text-sm text-danger" role="alert">
            {t("decks.failed")}
            <button type="button" className={buttonClass} onClick={retry}>
              {t("decks.retry")}
            </button>
          </p>
        ) : (
          <p className="text-sm text-muted" aria-busy="true">
            {t("decks.shareLoading")}
          </p>
        )
      ) : share.active ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("decks.shareUrl")}
            <input
              readOnly
              value={share.url}
              className="h-10 w-full border border-line bg-background px-2 font-mono text-xs text-foreground outline-none focus:border-cyan"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={primaryClass}
              onClick={() =>
                void copyText(share.url).then((ok) => setNote({ text: ok ? t("decks.shareCopied") : t("decks.copyFailed"), ok }))
              }
            >
              {t("decks.shareCopy")}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              title={t("decks.shareRotateHint")}
              onClick={() => void run({ method: "POST", body: JSON.stringify({ rotate: true }) }, () => t("decks.shareRotateHint"))}
            >
              {t("decks.shareRotate")}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => void run({ method: "DELETE" }, () => t("decks.shareRevoked"))}
            >
              {t("decks.shareRevoke")}
            </button>
            <button type="button" className={buttonClass} onClick={onClose}>
              {t("decks.close")}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={primaryClass} disabled={busy} onClick={() => void run({ method: "POST", body: "{}" }, () => null)}>
            {t("decks.shareCreate")}
          </button>
          <button type="button" className={buttonClass} onClick={onClose}>
            {t("decks.close")}
          </button>
        </div>
      )}
      {note ? (
        <p className={`text-xs ${note.ok ? "text-gain" : "text-danger"}`} aria-live="polite">
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
