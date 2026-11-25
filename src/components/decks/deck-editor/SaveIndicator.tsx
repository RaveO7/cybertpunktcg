"use client";

import { useTranslations } from "next-intl";
import type { SaveStatus } from "@/components/decks/hooks";

export function SaveIndicator({ status, error, onRetry }: { status: SaveStatus; error: string | null; onRetry: () => void }) {
  const t = useTranslations();
  if (status === "idle") return null;
  if (status === "error") {
    return (
      <span role="alert" className="flex items-center gap-2 text-xs text-danger">
        {error ?? t("decks.saveFailed")}
        <button type="button" className="underline hover:text-foreground" onClick={onRetry}>
          {t("decks.retry")}
        </button>
      </span>
    );
  }
  return (
    <span className="text-xs text-muted" aria-live="polite">
      {status === "saving" ? t("decks.saving") : t("decks.saved")}
    </span>
  );
}
