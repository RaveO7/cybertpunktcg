"use client";

import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";

/** Modifications refusées par le serveur pendant la synchronisation, avec le nom de la carte. */
export function SyncErrors() {
  const { syncErrors, dismissSyncError } = useCollection();
  const t = useTranslations();
  if (!syncErrors.length) return null;
  return (
    <ul role="alert" className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 pb-2">
      {syncErrors.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 border border-danger/60 px-3 py-2 text-sm text-danger">
          <span className="min-w-0 flex-1">
            {entry.kind === "corrupted"
              ? entry.message
              : entry.card
                ? t("offline.sync.rejected", { card: entry.card, reason: entry.message })
                : t("offline.sync.rejectedUnknown", { reason: entry.message })}
          </span>
          <button
            type="button"
            className="shrink-0 text-xs text-muted underline hover:text-foreground"
            onClick={() => dismissSyncError(entry.id)}
          >
            {t("offline.sync.dismiss")}
          </button>
        </li>
      ))}
    </ul>
  );
}
