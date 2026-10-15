"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { Link } from "@/i18n/navigation";
import { useSharedBinder } from "@/components/SharedBinderProvider";
import { aggregateCollection, computeProgress, marketValue, releasedChecklist, viewOwnership } from "@/lib/logic";
import {
  BETA_SET_CODE,
  ENGLISH_SET_ID,
  FRENCH_SET_ID,
  MAIN_SET_CODE,
} from "@/lib/reference-data";

const SCOPES = [
  { id: "en", checklist: ENGLISH_SET_ID, language: "en" as const },
  { id: "fr", checklist: FRENCH_SET_ID, language: "fr" as const },
];

export function SharedBinderHome() {
  const fmt = useNumberFormat();
  const { ready, error, data } = useSharedBinder();
  const t = useTranslations();

  const agg = useMemo(() => {
    if (!data) return new Map();
    return aggregateCollection(data.items);
  }, [data]);

  const scopes = useMemo(() => {
    if (!data) return [];
    return SCOPES.map((scope) => {
      const printings = releasedChecklist(data.catalog.printings, scope.checklist) ?? [];
      const ownership = viewOwnership(scope.checklist, data.catalog.printings, agg);
      const progress = computeProgress(printings, ownership);
      const market = marketValue(printings, ownership);
      return { ...scope, progress, market };
    });
  }, [agg, data]);

  if (!ready) return <p className="p-6 text-muted">{t("common.loading")}</p>;
  if (error === "not_found" || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl text-yellow">{t("share.notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("share.notFoundBody")}</p>
      </div>
    );
  }
  if (error) return <p className="p-6 text-danger">{t("share.loadFailed")}</p>;

  const cards = { pathname: "/classeur/[token]/cartes", params: { token: data.token } } as const;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t("share.eyebrow")}</p>
      <h1 className="mt-1 text-3xl text-yellow">{t("share.title", { name: data.ownerName })}</h1>
      <p className="mt-2 text-sm text-muted">{t("share.subtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {scopes.map((scope) => (
          <div key={scope.id} className="border border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {scope.language === "fr" ? t("common.french") : t("common.english")}
            </p>
            <p className="mt-2 text-2xl text-foreground">
              {fmt.int(scope.progress.uniqueOwned)}
              <span className="text-sm text-muted"> / {fmt.int(scope.progress.total)}</span>
            </p>
            <p className="mt-1 text-sm text-cyan">{fmt.percent(scope.progress.percent)}</p>
            <p className="mt-3 text-xs text-muted">
              {t("dashboard.missing")}: {fmt.int(scope.progress.missing)} · {t("dashboard.duplicates")}:{" "}
              {fmt.int(scope.progress.duplicates)}
            </p>
            {data.catalog.hasPrices && scope.market.pricedCopies > 0 ? (
              <p className="mt-2 text-xs text-muted">
                {t("share.marketHint", { n: fmt.int(scope.market.pricedCopies) })}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={{ ...cards, query: { collection: "owned" } }}
          className="inline-flex h-12 items-center border border-cyan px-4 text-sm text-cyan hover:bg-cyan/10"
        >
          {t("share.openOwned")}
        </Link>
        <Link
          href={cards}
          className="inline-flex h-12 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground"
        >
          {t("share.openAll")}
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted">
        {t("share.editionsNote")} ({BETA_SET_CODE} / {MAIN_SET_CODE})
      </p>
    </div>
  );
}
