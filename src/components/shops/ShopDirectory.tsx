"use client";

// Annuaire public des boutiques (vérifiées d'abord), en liste ou sur la carte.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { countryName } from "@/components/geo/countries";
import { useCountryOptions } from "@/components/geo/useCountryOptions";
import { LazyMap, type MapMarker } from "@/components/geo/LazyMap";
import { useI18n } from "@/components/LocaleProvider";
import { useLocalizedHref } from "@/components/site/useLocalizedHref";
import { formatKm } from "@/components/public/format";
import { NearPicker, type NearPoint } from "@/components/public/NearPicker";
import { VerifiedBadge } from "@/components/public/TournamentCard";
import { buttonClass, inputClass, panelClass } from "@/components/tournament/ui";
import type { ShopSummary } from "@/lib/shops/shops";

export type ShopDirectoryResult = { total: number; page: number; pageSize: number; shops: ShopSummary[] };
type Params = Record<string, string>;

const KEYS = ["country", "city", "lat", "lng", "radius", "place", "page", "view"] as const;

function clean(params: Params) {
  return Object.fromEntries(KEYS.flatMap((key) => (params[key] ? [[key, params[key]]] : []))) as Params;
}

/** Annuaire des boutiques : sur sa page, filtres dans l'URL ; intégré à l'accueil (`embedded`), filtres locaux. */
export function ShopDirectory({
  initialParams,
  initial,
  embedded = false,
}: {
  initialParams: Params;
  initial: ShopDirectoryResult | null;
  embedded?: boolean;
}) {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const pathname = usePathname();
  const [params, setParams] = useState<Params>(() => clean(initialParams));
  const [result, setResult] = useState<ShopDirectoryResult | null>(initial);
  const [error, setError] = useState(false);
  const firstLoad = useRef(initial !== null);
  const view = params.view === "map" ? "map" : "list";
  const countries = useCountryOptions(locale, params.country);
  const near: NearPoint | null = params.lat && params.lng ? { lat: Number(params.lat), lng: Number(params.lng), radius: Number(params.radius) || 25, label: params.place ?? "" } : null;

  function update(patch: Params, keepPage = false) {
    const next = clean({ ...params, ...patch, ...(keepPage ? {} : { page: "" }) });
    setParams(next);
    if (embedded) return;
    const qs = new URLSearchParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const apiQuery = useMemo(() => {
    const api = new URLSearchParams(clean(params));
    api.delete("place");
    api.delete("view");
    return api.toString();
  }, [params]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const controller = new AbortController();
    fetch(`/api/shops?${apiQuery}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("shops");
        setResult((await response.json()) as ShopDirectoryResult);
        setError(false);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [apiQuery]);

  const markers = useMemo<MapMarker[]>(
    () =>
      (result?.shops ?? []).map((shop) => ({
        lat: shop.lat,
        lng: shop.lng,
        highlight: shop.verified,
        items: [{ label: shop.name, href: href("shop", { slug: shop.slug }), detail: shop.city }],
      })),
    [result, href],
  );
  const circle = useMemo(() => (near ? { lat: near.lat, lng: near.lng, radiusKm: near.radius } : null), [near?.lat, near?.lng, near?.radius]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const page = result?.page ?? 1;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6">
      {/* Intégré à l'accueil : l'onglet tient lieu de titre. */}
      {embedded ? null : (
        <div className="flex flex-col gap-1">
          <Link href="/tournois/publics" className="text-xs text-muted hover:text-foreground">
            ← {t.publicTournaments.title}
          </Link>
          <h1 className="text-2xl text-yellow sm:text-4xl">{t.shops.title}</h1>
          <p className="max-w-2xl text-sm text-muted">{t.shops.subtitle}</p>
        </div>
      )}

      <section className={`${panelClass} flex flex-col gap-3`} aria-label={t.publicTournaments.filters}>
        <NearPicker
          value={near}
          onChange={(point) =>
            update(point ? { lat: String(point.lat), lng: String(point.lng), radius: String(point.radius), place: point.label } : { lat: "", lng: "", radius: "", place: "" })
          }
        />
        <label className="flex max-w-xs flex-col gap-1">
          <span className="hud-label">{t.geo.country}</span>
          <select className={inputClass} value={params.country ?? ""} onChange={(event) => update({ country: event.target.value, city: "" })}>
            <option value="">{t.publicTournaments.allCountries}</option>
            {countries.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud-label" aria-live="polite">
          {result ? t.shops.count(result.total) : t.common.loading}
        </p>
        <div className="flex border border-line" role="group">
          {(["list", "map"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              className={`h-9 px-3 text-sm ${view === mode ? "bg-panel-2 text-yellow" : "text-muted hover:text-foreground"}`}
              onClick={() => update({ view: mode === "map" ? "map" : "" }, true)}
            >
              {mode === "map" ? t.geo.map : t.geo.list}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{t.shops.loadFailed}</p> : null}

      {view === "map" ? (
        <LazyMap markers={markers} circle={circle} label={t.geo.mapLabel} className="h-[60vh] min-h-80" />
      ) : result && result.shops.length === 0 ? (
        <p className={`${panelClass} text-sm text-muted`}>{t.shops.noShops}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result?.shops.map((shop) => (
            <li key={shop.id}>
              <Link
                href={href("shop", { slug: shop.slug })}
                className={`flex h-full items-center gap-3 border bg-panel p-3 transition hover:border-cyan ${shop.verified ? "border-yellow/40" : "border-line"}`}
              >
                {shop.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo déjà réduit à 256 px, servi par l'API
                  <img src={shop.logoUrl} alt="" width={48} height={48} className="size-12 shrink-0 border border-line object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center border border-line text-lg text-muted">
                    {shop.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate">{shop.name}</span>
                  <span className="text-xs text-muted">
                    {shop.city} · {countryName(shop.country, locale)}
                    {shop.distanceKm !== null ? ` · ${t.geo.distance(formatKm(shop.distanceKm, locale))}` : ""}
                  </span>
                  {shop.verified ? <VerifiedBadge /> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {view === "list" && pages > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label={t.publicTournaments.pagination}>
          <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
            {t.publicTournaments.previous}
          </button>
          <span className="text-muted">{t.publicTournaments.page(page, pages)}</span>
          <button type="button" className={buttonClass} disabled={page >= pages} onClick={() => update({ page: String(page + 1) }, true)}>
            {t.publicTournaments.next}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
