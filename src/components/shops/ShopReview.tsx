"use client";

// File de validation des boutiques, réservée aux administrateurs (cf. specs/shops/verification).

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { placeLabel } from "@/components/geo/AddressField";
import { countryName } from "@/components/geo/countries";
import { buttonClass, dangerClass, inputClass, panelClass, primaryClass } from "@/components/tournament/ui";
import { intlLocale } from "@/i18n/config";
import { ApiError, api } from "@/lib/client/api";
import { useApiErrorMessage } from "@/lib/client/use-api-error-message";
import type { AdminShop, ShopStatus } from "@/lib/shops/shops";

const TABS: ShopStatus[] = ["pending", "verified", "rejected"];

export function ShopReview() {
  const t = useTranslations();
  const [tab, setTab] = useState<ShopStatus>("pending");
  const [shops, setShops] = useState<AdminShop[] | null>(null);
  const [state, setState] = useState<"ok" | "forbidden" | "failed">("ok");

  const load = useCallback(async () => {
    try {
      const body = await api(`/api/admin/shops?status=${tab}`, { schema: "adminShopsSchema", cache: "no-store" });
      setState("ok");
      setShops(body.shops);
    } catch (error) {
      setState(error instanceof ApiError && (error.status === 401 || error.status === 403) ? "forbidden" : "failed");
    }
  }, [tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (state === "forbidden") return <p className="p-6 text-center text-sm text-muted">{t("shops.adminOnly")}</p>;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1000px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <h1 className="text-2xl text-yellow sm:text-3xl">{t("shops.adminTitle")}</h1>
      <nav className="flex border border-line" aria-label={t("shops.adminTitle")}>
        {TABS.map((status) => (
          <button
            key={status}
            type="button"
            aria-current={tab === status ? "page" : undefined}
            className={`h-11 flex-1 text-sm ${tab === status ? "bg-panel-2 text-yellow" : "text-muted hover:text-foreground"}`}
            onClick={() => {
              setShops(null);
              setTab(status);
            }}
          >
            {t(`shops.adminTabs.${status}`)}
          </button>
        ))}
      </nav>
      {state === "failed" ? <p className="text-sm text-danger">{t("shops.loadFailed")}</p> : null}
      {shops === null && state === "ok" ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
      {shops?.length === 0 ? <p className={`${panelClass} text-sm text-muted`}>{t("shops.adminEmpty")}</p> : null}
      {shops?.map((shop) => (
        <ReviewCard key={shop.id} shop={shop} onDone={load} />
      ))}
    </div>
  );
}

function ReviewCard({ shop, onDone }: { shop: AdminShop; onDone: () => Promise<void> }) {
  const t = useTranslations();
  const locale = useLocale();
  const requestError = useApiErrorMessage();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function decide(decision: "verify" | "reject" | "revoke") {
    setPending(true);
    setError(null);
    try {
      await api(`/api/admin/shops/${shop.id}/review`, { body: { decision, note: note.trim() || undefined } });
    } catch (failure) {
      setError(requestError(failure, t("tournaments.failed")));
      return;
    } finally {
      setPending(false);
    }
    await onDone();
  }

  const date = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className={`${panelClass} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">{shop.name}</h2>
        {shop.status !== "rejected" ? (
          <Link href={{ pathname: "/boutiques/[slug]", params: { slug: shop.slug } }} className="text-sm text-cyan underline" target="_blank">
            {t("shops.publicPage")}
          </Link>
        ) : null}
      </div>
      <p className="text-sm">
        {placeLabel(shop.place)} · {countryName(shop.country, locale)}
      </p>
      <p className="text-xs text-muted">
        {t("shops.owner", { name: shop.owner.displayName, email: shop.owner.email ?? "—" })} · {t("shops.requestedAt", { date: date.format(new Date(shop.createdAt)) })}
      </p>
      {shop.website ? (
        <a href={shop.website} target="_blank" rel="nofollow noopener noreferrer" className="text-sm break-all text-cyan underline">
          {shop.website}
        </a>
      ) : null}
      {shop.description ? <p className="text-sm whitespace-pre-line text-muted">{shop.description}</p> : null}
      {shop.reviewNote ? <p className="text-sm text-danger">{t("shops.rejectedHint", { note: shop.reviewNote })}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {shop.status !== "rejected" ? (
        <div className="flex flex-col gap-2 border-t border-line pt-2">
          <input className={inputClass} value={note} maxLength={500} placeholder={t("shops.reasonPlaceholder")} onChange={(event) => setNote(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {shop.status === "pending" ? (
              <>
                <button type="button" className={primaryClass} disabled={pending} onClick={() => void decide("verify")}>
                  {t("shops.verify")}
                </button>
                <button type="button" className={dangerClass} disabled={pending || !note.trim()} onClick={() => void decide("reject")}>
                  {t("shops.reject")}
                </button>
              </>
            ) : (
              <button type="button" className={dangerClass} disabled={pending || !note.trim()} onClick={() => void decide("revoke")}>
                {t("shops.revoke")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" className={`${buttonClass} self-start`} disabled={pending} onClick={() => void decide("verify")}>
          {t("shops.verify")}
        </button>
      )}
    </section>
  );
}
