"use client";

import { Suspense } from "react";
import { CardsExplorer } from "@/components/CardsExplorer";
import { useSharedBinder } from "@/components/SharedBinderProvider";
import { useI18n } from "@/components/LocaleProvider";

export function SharedBinderCards() {
  const { ready, error, data } = useSharedBinder();
  const { t } = useI18n();

  if (!ready) return <p className="p-6 text-muted">{t.common.loading}</p>;
  if (error === "not_found" || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl text-yellow">{t.share.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.share.notFoundBody}</p>
      </div>
    );
  }
  if (error) return <p className="p-6 text-danger">{t.share.loadFailed}</p>;

  return (
    <div>
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t.share.eyebrow}</p>
        <p className="mt-1 text-sm text-muted">{t.share.cardsBanner(data.ownerName)}</p>
      </div>
      <Suspense fallback={<p className="p-6 text-sm text-muted">{t.common.loading}</p>}>
        <CardsExplorer
          readOnly
          catalog={data.catalog}
          items={data.items}
          urlBase={`/classeur/${data.token}/cartes`}
          syncBrowseSelection={false}
        />
      </Suspense>
    </div>
  );
}
