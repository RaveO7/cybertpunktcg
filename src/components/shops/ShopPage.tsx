"use client";

// Page publique d'une boutique : identité, contact, carte, prochains tournois publics et
// derniers résultats (cf. specs/shops/profile).

import Link from "next/link";
import { useMemo } from "react";
import { placeLabel } from "@/components/geo/AddressField";
import { countryName } from "@/components/geo/countries";
import { LazyMap, type MapMarker } from "@/components/geo/LazyMap";
import { useI18n } from "@/components/LocaleProvider";
import { useLocalizedHref } from "@/components/site/useLocalizedHref";
import { formatStart } from "@/components/public/format";
import { TournamentCard, VerifiedBadge } from "@/components/public/TournamentCard";
import { panelClass } from "@/components/tournament/ui";
import type { ShopDetail } from "@/lib/shops/shops";
import type { PublicTournamentSummary } from "@/lib/tournament/public-view";

export type ShopPastResult = PublicTournamentSummary & { championName: string | null };

const externalLink = { target: "_blank", rel: "nofollow noopener noreferrer" } as const;

export function ShopPage({ shop, upcoming, past }: { shop: ShopDetail; upcoming: PublicTournamentSummary[]; past: ShopPastResult[] }) {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const markers = useMemo<MapMarker[]>(
    () => [{ lat: shop.lat, lng: shop.lng, highlight: true, items: [{ label: shop.name, href: "#" }] }],
    [shop.lat, shop.lng, shop.name],
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <Link href={href("shops")} className="text-xs text-muted hover:text-foreground">
        ← {t.shops.title}
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo déjà réduit à 256 px, servi par l'API
          <img src={shop.logoUrl} alt="" width={96} height={96} className="size-20 border border-line object-cover sm:size-24" />
        ) : null}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl text-yellow sm:text-4xl">{shop.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {shop.city} · {countryName(shop.country, locale)}
            {shop.verified ? <VerifiedBadge /> : null}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section className={`${panelClass} flex flex-col gap-3`}>
          {shop.description ? <p className="text-sm whitespace-pre-line">{shop.description}</p> : null}
          <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="hud-label">{t.geo.address}</dt>
            <dd>{placeLabel(shop.place)}</dd>
            {shop.hours ? (
              <>
                <dt className="hud-label">{t.shops.hours}</dt>
                <dd className="whitespace-pre-line">{shop.hours}</dd>
              </>
            ) : null}
            {shop.phone ? (
              <>
                <dt className="hud-label">{t.shops.phone}</dt>
                <dd>
                  <a href={`tel:${shop.phone.replace(/\s+/g, "")}`} className="text-cyan underline">
                    {shop.phone}
                  </a>
                </dd>
              </>
            ) : null}
            {shop.contactEmail ? (
              <>
                <dt className="hud-label">{t.shops.email}</dt>
                <dd>
                  <a href={`mailto:${shop.contactEmail}`} className="text-cyan underline">
                    {shop.contactEmail}
                  </a>
                </dd>
              </>
            ) : null}
            {shop.website ? (
              <>
                <dt className="hud-label">{t.shops.website}</dt>
                <dd className="truncate">
                  <a href={shop.website} {...externalLink} className="text-cyan underline">
                    {shop.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
          {shop.socials.length ? (
            <p className="flex flex-wrap gap-3 text-sm">
              {shop.socials.map((social) => (
                <a key={social.url} href={social.url} {...externalLink} className="text-cyan underline">
                  {t.shops.socialKinds[social.kind as keyof typeof t.shops.socialKinds] ?? social.kind}
                </a>
              ))}
            </p>
          ) : null}
        </section>
        <LazyMap markers={markers} zoom={16} label={t.geo.mapLabel} className="h-64 lg:h-full lg:min-h-64" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">{t.publicTournaments.upcoming}</h2>
        {upcoming.length === 0 ? <p className={`${panelClass} text-sm text-muted`}>{t.publicTournaments.noUpcoming}</p> : null}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((row) => (
            <li key={row.id}>
              <TournamentCard tournament={row} />
            </li>
          ))}
        </ul>
      </section>

      {past.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">{t.publicTournaments.past}</h2>
          <ul className={`${panelClass} flex flex-col text-sm`}>
            {past.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
                <Link href={href("tournament", { id: row.id })} className="text-cyan underline">
                  {row.name}
                </Link>
                <span className="text-muted">
                  {formatStart(row.startsAt, row.timeZone, locale)}
                  {row.championName ? ` · ${t.publicTournaments.championLine(row.championName)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
