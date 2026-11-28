"use client";

import { useTranslations } from "next-intl";
import { useShareLink } from "./use-share-link";

export function ShareSection() {
  const t = useTranslations();
  const { share, shareBusy, shareNote, createShare, revokeShareLink, copyShareLink } = useShareLink();

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.shareTitle")}</h2>
      <p className="mt-2 text-sm text-muted">{t("settings.shareHint")}</p>
      {share?.active && share.url ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.shareLink")}</span>
            <input
              readOnly
              className="mt-2 h-12 w-full border border-line-field bg-background px-3 text-sm text-foreground outline-none"
              value={share.url}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => void copyShareLink()}
              className="h-11 border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
            >
              {t("settings.shareCopy")}
            </button>
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => void createShare(true)}
              className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
            >
              {t("settings.shareRotate")}
            </button>
          </div>
          <button
            type="button"
            disabled={shareBusy}
            onClick={() => void revokeShareLink()}
            className="h-11 w-full border border-line text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-60"
          >
            {t("settings.shareRevoke")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={shareBusy || share == null}
          onClick={() => void createShare(false)}
          className="mt-4 h-12 w-full border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
        >
          {shareBusy || share == null ? t("settings.shareLoading") : t("settings.shareCreate")}
        </button>
      )}
      {shareNote ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {shareNote}
        </p>
      ) : null}
    </section>
  );
}
