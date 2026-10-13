"use client";

// Fiche publique d'un tournoi : informations, lieu sur la carte, inscription sans code,
// agenda, partage, et résultats une fois terminé (cf. specs/tournaments/public-listing).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { placeLabel } from "@/components/geo/AddressField";
import { countryName } from "@/components/geo/countries";
import { LazyMap, type MapMarker } from "@/components/geo/LazyMap";
import { useI18n } from "@/components/LocaleProvider";
import { useLocalizedHref } from "@/components/site/useLocalizedHref";
import { ApiError, postJson } from "@/components/tournament/hooks";
import { buttonClass, inputClass, panelClass, primaryClass, Tag } from "@/components/tournament/ui";
import type { PublicTournamentDetail } from "@/lib/tournament/public-view";
import { formatFee, formatStart } from "./format";
import { SeatsTag, VerifiedBadge } from "./TournamentCard";

const DEFAULT_DISPLAY_NAME = "Ma collection";

export function PublicTournamentPage({ tournament }: { tournament: PublicTournamentDetail }) {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const [copied, setCopied] = useState(false);
  const place = tournament.place;
  const markers = useMemo<MapMarker[]>(
    () => (place ? [{ lat: place.lat, lng: place.lng, highlight: true, items: [{ label: tournament.venueName ?? tournament.name, href: "#" }] }] : []),
    [place, tournament.venueName, tournament.name],
  );
  const finished = tournament.status === "termine" || tournament.status === "annule";

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: tournament.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Partage annulé.
    }
  }

  const info: [string, React.ReactNode][] = [
    [t.publicTournaments.startsAt, formatStart(tournament.startsAt, tournament.timeZone, locale, "long")],
    [t.publicTournaments.entryFee, formatFee(tournament.entryFeeCents, tournament.currency, locale, t.publicTournaments.free)],
    [
      t.tournaments.formatLabel,
      `${t.tournaments.formats[tournament.format]} · ${tournament.matchType === "bo1" ? t.tournaments.bo1 : t.tournaments.bo3} · ${t.publicTournaments.formatLine(tournament.swissRounds, tournament.roundMinutes)}`,
    ],
    [t.publicTournaments.playersLabel, <PlayersLine key="players" tournament={tournament} />],
  ];
  if (tournament.prizes) info.push([t.publicTournaments.prizes, tournament.prizes]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1000px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-col gap-2">
        <Link href={href("tournaments")} className="text-xs text-muted hover:text-foreground">
          ← {t.publicTournaments.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl text-yellow sm:text-4xl">{tournament.name}</h1>
          <Tag tone={finished ? "muted" : "cyan"}>{t.tournaments.statuses[tournament.status]}</Tag>
        </div>
        <p className="text-sm text-muted">
          {tournament.shop ? (
            <>
              {t.publicTournaments.organizedByLabel}{" "}
              <Link href={href("shop", { slug: tournament.shop.slug })} className="text-cyan underline">
                {tournament.shop.name}
              </Link>{" "}
              {tournament.shop.verified ? <VerifiedBadge /> : null}
            </>
          ) : tournament.organizerName ? (
            t.publicTournaments.organizedBy(tournament.organizerName)
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section className={`${panelClass} flex flex-col gap-3`}>
          <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            {info.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="hud-label pt-0.5">{label}</dt>
                <dd className="text-sm whitespace-pre-line">{value}</dd>
              </div>
            ))}
          </dl>
          {tournament.description ? (
            <div className="border-t border-line pt-3">
              <h2 className="hud-label mb-1">{t.publicTournaments.description}</h2>
              <p className="text-sm whitespace-pre-line">{tournament.description}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {!finished && tournament.startsAt ? (
              <a href={`/api/tournaments/public/${tournament.id}/calendar`} className={buttonClass} download>
                {t.publicTournaments.addToCalendar}
              </a>
            ) : null}
            <button type="button" className={buttonClass} onClick={() => void share()}>
              {copied ? t.publicTournaments.linkCopied : t.publicTournaments.share}
            </button>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {!finished ? <PublicJoin tournament={tournament} /> : null}
          {place ? (
            <section className={`${panelClass} flex flex-col gap-2`}>
              <h2 className="hud-label">{t.publicTournaments.venue}</h2>
              <p className="text-sm">
                {placeLabel(place)}
                <span className="text-muted"> · {countryName(place.country, locale)}</span>
              </p>
              <LazyMap markers={markers} zoom={15} label={t.geo.mapLabel} className="h-56" />
              <a
                className="text-sm text-cyan underline"
                href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.publicTournaments.openMap}
              </a>
            </section>
          ) : null}
        </div>
      </div>

      {tournament.standings ? (
        <section className={panelClass}>
          <h2 className="mb-2 text-lg text-yellow">{t.publicTournaments.standingsTitle}</h2>
          {tournament.championName ? <p className="mb-3 text-base">{t.publicTournaments.championLine(tournament.championName)}</p> : null}
          <ol className="flex flex-col text-sm">
            {tournament.standings.map((row) => (
              <li key={`${row.rank}-${row.name}`} className="flex items-center gap-3 border-t border-line py-1.5">
                <span className="w-8 font-mono text-muted">{row.rank}</span>
                <span className="flex-1">
                  {row.name} {row.champion ? <Tag tone="yellow">{t.tournaments.champion}</Tag> : null}
                </span>
                <span className="font-mono text-muted">
                  {row.wins}-{row.draws}-{row.losses}
                </span>
                <span className="w-14 text-right font-mono">{t.publicTournaments.points(row.points)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function PlayersLine({ tournament }: { tournament: PublicTournamentDetail }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{t.publicTournaments.players(tournament.playerCount)}</span>
      <SeatsTag tournament={tournament} />
      {tournament.waitlistCount ? <span className="text-muted">{t.publicTournaments.waitlistCount(tournament.waitlistCount)}</span> : null}
    </span>
  );
}

/** Inscription sans code : avec le compte connecté, ou en invité avec un pseudo. */
function PublicJoin({ tournament }: { tournament: PublicTournamentDetail }) {
  const { t } = useI18n();
  const { user } = useCollection();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const accountName = user && user.displayName !== DEFAULT_DISPLAY_NAME ? user.displayName : null;
  const full = tournament.seatsLeft === 0;

  if (!tournament.registrationOpen) {
    return <p className={`${panelClass} text-sm text-muted`}>{t.publicTournaments.registrationClosed}</p>;
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const body = name.trim() ? { name: name.trim() } : {};
      const result = await postJson<{ code: string }>(`/api/tournaments/public/${tournament.id}/join`, body);
      router.push(`/t/${result.code}`);
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 0 ? t.tournaments.offline : error instanceof Error ? error.message : t.tournaments.failed);
      setPending(false);
    }
  }

  const disabled = pending || (!accountName && !name.trim());
  return (
    <form className={`${panelClass} flex flex-col gap-3`} onSubmit={(event) => void join(event)}>
      <h2 className="text-lg">{full ? t.publicTournaments.joinWaitlist : t.publicTournaments.join}</h2>
      {tournament.requireApproval ? <p className="text-xs text-muted">{t.publicTournaments.approvalRequired}</p> : null}
      {full ? <p className="text-xs text-yellow">{t.publicTournaments.fullHint}</p> : null}
      <label className="flex flex-col gap-1">
        <span className="hud-label">{t.tournaments.joinAs}</span>
        <input
          className={inputClass}
          value={name}
          maxLength={32}
          placeholder={accountName ?? t.tournaments.playerName}
          autoComplete="nickname"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {!user ? <p className="text-xs text-muted">{t.tournaments.guestHint}</p> : null}
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      <button type="submit" className={`${primaryClass} h-12`} disabled={disabled}>
        {accountName && !name.trim() ? t.tournaments.joinWithAccount(accountName) : t.tournaments.joinButton}
      </button>
    </form>
  );
}
