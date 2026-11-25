"use client";

import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";

/** Modifications de la collection faites hors ligne et pas encore envoyées. */
export function SyncStatus() {
  const { pendingCount, syncing } = useCollection();
  const t = useTranslations();
  return (
    <span role="status" className={pendingCount ? "flex shrink-0 items-center gap-1.5 text-xs text-yellow" : "sr-only"}>
      {pendingCount ? (
        <>
          <span className={`size-2 shrink-0 bg-yellow ${syncing ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
          <span>{t("offline.sync.pending", { n: pendingCount })}</span>
          {syncing ? <span className="text-muted">· {t("offline.sync.syncing")}</span> : null}
        </>
      ) : null}
    </span>
  );
}
