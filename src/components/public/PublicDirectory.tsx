"use client";

// Annuaire des tournois publics (cf. specs/tournaments/discovery) : liste paginée ou carte. Le premier
// rendu vient du serveur. Sur sa page (/tournois/publics), les filtres sont reflétés dans l'URL (lien
// partageable) ; intégré à l'accueil (`embedded`), ils restent locaux pour ne pas se mêler à l'annuaire
// des boutiques affiché sur la même page.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { countryName } from "@/components/geo/countries";
import { LazyMap, type MapMarker } from "@/components/geo/LazyMap";
import { useI18n } from "@/components/LocaleProvider";
import { useLocalizedHref } from "@/components/site/useLocalizedHref";
import { buttonClass, inputClass, panelClass } from "@/components/tournament/ui";
import type { DirectoryFacets, DirectoryResult } from "@/lib/tournament/directory";
import { isPeriod, PERIODS, type Period } from "@/lib/tournament/periods";
import { apiParams, cleanParams, PAGE_KEYS, type DirectoryParams } from "./directory-params";
import { formatStart } from "./format";
import { NearPicker, type NearPoint } from "./NearPicker";
import { TournamentCard } from "./TournamentCard";

function nearOf(params: DirectoryParams): NearPoint | null {
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  if (!params.lat || !params.lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, radius: Number(params.radius) || 25, label: params.place || "" };
}

export function PublicDirectory({
  initialParams,
  initial,
  embedded = false,
}: {
  initialParams: DirectoryParams;
  initial: DirectoryResult | null;
  embedded?: boolean;
}) {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const pathname = usePathname();
  const [params, setParams] = useState<DirectoryParams>(() => cleanParams(initialParams));
  const [result, setResult] = useState<DirectoryResult | null>(initial);
  const [facets, setFacets] = useState<DirectoryFacets | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const firstLoad = useRef(initial !== null);
  const view = params.view === "map" ? "map" : "list";
  const near = nearOf(params);
  const period: Period = isPeriod(params.period) ? params.period : "any";

  function update(patch: DirectoryParams, keepPage = false) {
    const next = cleanParams({ ...params, ...patch, ...(keepPage ? {} : { page: "" }) });
    setParams(next);
    if (embedded) return;
    const qs = new URLSearchParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const apiQuery = apiParams(params, new Date()).toString();

  useEffect(() => {
    if (firstLoad.current) {
      // Données du rendu serveur : pas de second chargement.
      firstLoad.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/tournaments/public?${apiQuery}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("directory");
        setResult((await response.json()) as DirectoryResult);
        setError(false);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setError(true);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const qs = new URLSearchParams({ ...(params.country ? { country: params.country } : {}), ...(params.region ? { region: params.region } : {}) });
    fetch(`/api/tournaments/public/facets?${qs}`, { signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as DirectoryFacets) : null))
      .then((body) => {
        if (body) setFacets(body);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [params.country, params.region]);

  const markers = useMemo<MapMarker[]>(
    () =>
      (result?.tournaments ?? []).flatMap((row) =>
        row.lat !== null && row.lng !== null
          ? [
              {
                lat: row.lat,
                lng: row.lng,
                highlight: row.shop?.verified ?? false,
                items: [
                  {
                    label: row.name,
                    href: href("tournament", { id: row.id }),
                    detail: [formatStart(row.startsAt, row.timeZone, locale), row.venueName ?? row.city].filter(Boolean).join(" · "),
                  },
                ],
              },
            ]
          : [],
      ),
    [result, locale, href],
  );
  const circle = useMemo(() => (near ? { lat: near.lat, lng: near.lng, radiusKm: near.radius } : null), [near?.lat, near?.lng, near?.radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const page = result?.page ?? 1;
  const hasFilters = Object.keys(params).some((key) => key !== "view" && key !== "page");

  const select = (key: string, label: string, options: { value: string; label: string }[], all: string) => (
    <label className="flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <select className={inputClass} value={params[key] ?? ""} onChange={(event) => update({ [key]: event.target.value })}>
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6">
      {/* Intégré à l'accueil : l'onglet tient lieu de titre. */}
      {embedded ? null : (
        <div className="flex flex-col gap-1">
          <Link href="/tournois" className="text-xs text-muted hover:text-foreground">
            ← {t.tournaments.title}
          </Link>
          <h1 className="text-2xl text-yellow sm:text-4xl">{t.publicTournaments.title}</h1>
          <p className="max-w-2xl text-sm text-muted">{t.publicTournaments.subtitle}</p>
          <p className="flex flex-wrap gap-3 text-sm">
            <Link href="/boutiques" className="text-cyan underline">
              {t.publicTournaments.shopsLink}
            </Link>
          </p>
        </div>
      )}

      <section className={`${panelClass} flex flex-col gap-3`} aria-label={t.publicTournaments.filters}>
        <NearPicker
          value={near}
          onChange={(point) =>
            update(
              point
                ? { lat: String(point.lat), lng: String(point.lng), radius: String(point.radius), place: point.label, sort: params.sort || "distance" }
                : { lat: "", lng: "", radius: "", place: "", sort: params.sort === "distance" ? "" : (params.sort ?? "") },
            )
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {select(
            "country",
            t.geo.country,
            (facets?.countries ?? (params.country ? [params.country] : [])).map((code) => ({ value: code, label: countryName(code, locale) })),
            t.publicTournaments.allCountries,
          )}
          {params.country
            ? select("region", t.publicTournaments.region, (facets?.regions ?? []).map((region) => ({ value: region, label: region })), t.publicTournaments.allRegions)
            : null}
          {params.country
            ? select("city", t.geo.city, (facets?.cities ?? []).map((city) => ({ value: city.key, label: city.name })), t.publicTournaments.allCities)
            : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t.publicTournaments.period}</span>
            <select className={inputClass} value={period} onChange={(event) => update({ period: event.target.value === "any" ? "" : event.target.value, from: "", to: "" })}>
              {PERIODS.map((value) => (
                <option key={value} value={value}>
                  {t.publicTournaments.periods[value]}
                </option>
              ))}
            </select>
          </label>
          {period === "custom" ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="hud-label">{t.publicTournaments.from}</span>
                <input type="date" className={inputClass} value={params.from ?? ""} onChange={(event) => update({ from: event.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="hud-label">{t.publicTournaments.to}</span>
                <input type="date" className={inputClass} value={params.to ?? ""} onChange={(event) => update({ to: event.target.value })} />
              </label>
            </>
          ) : null}
          {select(
            "format",
            t.tournaments.formatLabel,
            [
              { value: "boutique", label: t.tournaments.formats.boutique },
              { value: "competitif", label: t.tournaments.formats.competitif },
            ],
            t.publicTournaments.anyFormat,
          )}
          {select(
            "match",
            t.tournaments.matchTypeLabel,
            [
              { value: "bo1", label: t.tournaments.bo1 },
              { value: "bo3", label: t.tournaments.bo3 },
            ],
            t.publicTournaments.anyMatch,
          )}
          {select(
            "price",
            t.publicTournaments.price,
            [
              { value: "free", label: t.publicTournaments.free },
              { value: "paid", label: t.publicTournaments.paid },
            ],
            t.publicTournaments.anyPrice,
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={params.seats === "1"} onChange={(event) => update({ seats: event.target.checked ? "1" : "" })} />
            {t.publicTournaments.seatsOnly}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={params.open === "1"} onChange={(event) => update({ open: event.target.checked ? "1" : "" })} />
            {t.publicTournaments.openOnly}
          </label>
          {near ? (
            <label className="flex items-center gap-2">
              <span className="hud-label">{t.publicTournaments.sort}</span>
              <select className={`${inputClass} h-8 w-auto`} value={params.sort === "date" ? "date" : "distance"} onChange={(event) => update({ sort: event.target.value })}>
                <option value="distance">{t.publicTournaments.sortDistance}</option>
                <option value="date">{t.publicTournaments.sortDate}</option>
              </select>
            </label>
          ) : null}
          {hasFilters ? (
            <button type="button" className="text-xs text-muted underline" onClick={() => update({ ...Object.fromEntries(PAGE_KEYS.map((key) => [key, ""])), view: params.view ?? "" })}>
              {t.publicTournaments.resetFilters}
            </button>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud-label" aria-live="polite">
          {loading ? t.common.loading : result ? t.publicTournaments.results(result.total) : ""}
        </p>
        <div className="flex border border-line" role="group">
          {(["list", "map"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              className={`h-9 px-3 text-sm ${view === mode ? "bg-panel-2 text-yellow" : "text-muted hover:text-foreground"}`}
              onClick={() => update({ view: mode === "map" ? "map" : "" })}
            >
              {mode === "map" ? t.geo.map : t.geo.list}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{t.publicTournaments.loadFailed}</p> : null}

      {view === "map" ? (
        <LazyMap markers={markers} circle={circle} label={t.geo.mapLabel} className="h-[60vh] min-h-80" />
      ) : result && result.tournaments.length === 0 ? (
        <p className={`${panelClass} text-sm text-muted`}>{t.publicTournaments.noResults}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result?.tournaments.map((row) => (
            <li key={row.id}>
              <TournamentCard tournament={row} />
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
