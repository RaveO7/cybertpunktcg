"use client";

import Link from "next/link";
import { useI18n } from "@/components/LocaleProvider";
import { useLocalizedHref } from "@/components/site/useLocalizedHref";
import { Tag } from "@/components/tournament/ui";
import type { PublicTournamentSummary } from "@/lib/tournament/public-view";
import { formatFee, formatKm, formatStart } from "./format";

export function SeatsTag({ tournament }: { tournament: Pick<PublicTournamentSummary, "seatsLeft" | "waitlistCount"> }) {
  const { t } = useI18n();
  if (tournament.seatsLeft === null) return <Tag>{t.publicTournaments.unlimited}</Tag>;
  if (tournament.seatsLeft === 0) return <Tag tone="danger">{t.publicTournaments.full}</Tag>;
  return <Tag tone={tournament.seatsLeft <= 3 ? "yellow" : "muted"}>{t.publicTournaments.seatsLeft(tournament.seatsLeft)}</Tag>;
}

export function VerifiedBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex h-5 items-center gap-1 border border-yellow/60 px-1.5 text-[11px] text-yellow" title={t.publicTournaments.verified}>
      <span aria-hidden="true">✓</span>
      {t.publicTournaments.verified}
    </span>
  );
}

export function TournamentCard({ tournament }: { tournament: PublicTournamentSummary }) {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const started = tournament.status !== "inscriptions";
  return (
    <Link
      href={href("tournament", { id: tournament.id })}
      className={`flex h-full flex-col gap-2 border bg-panel p-3 transition hover:border-cyan ${tournament.shop?.verified ? "border-yellow/40" : "border-line"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-base">{tournament.name}</span>
        {tournament.shop?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo déjà réduit à 256 px, servi par l'API
          <img src={tournament.shop.logoUrl} alt="" width={36} height={36} className="size-9 shrink-0 border border-line object-cover" />
        ) : null}
      </span>
      <span className="font-mono text-sm text-cyan">{formatStart(tournament.startsAt, tournament.timeZone, locale)}</span>
      <span className="text-sm text-muted">
        {[tournament.venueName, tournament.city].filter(Boolean).join(" · ")}
        {tournament.distanceKm !== null ? ` · ${t.geo.distance(formatKm(tournament.distanceKm, locale))}` : ""}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        {started ? <Tag tone="cyan">{t.tournaments.statuses[tournament.status]}</Tag> : null}
        <Tag tone="yellow">{formatFee(tournament.entryFeeCents, tournament.currency, locale, t.publicTournaments.free)}</Tag>
        <Tag>{t.tournaments.formats[tournament.format]}</Tag>
        <Tag>{tournament.matchType === "bo1" ? t.tournaments.bo1 : t.tournaments.bo3}</Tag>
        <SeatsTag tournament={tournament} />
        {!tournament.registrationOpen ? <Tag tone="danger">{t.publicTournaments.registrationClosed}</Tag> : null}
      </span>
      {tournament.shop ? (
        <span className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted">
          {tournament.shop.name}
          {tournament.shop.verified ? <VerifiedBadge /> : null}
        </span>
      ) : null}
    </Link>
  );
}
