"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCollection } from "@/components/CollectionProvider";
import type { MatchResult } from "@/lib/tournament/scores";
import type { MatchView, RoundView, TournamentView } from "@/lib/tournament/view";
import { ApiError, postJson, useServerNow, useTournamentState } from "./hooks";
import { Centered } from "./TournamentConsole";
import {
  buttonClass,
  dangerClass,
  FinalStandings,
  inputClass,
  matchResult,
  panelClass,
  primaryClass,
  RoundClockDisplay,
  roundTitle,
  scoreLabel,
  ScorePicker,
  StandingsTable,
  Tag,
} from "./ui";

/** Résolution du code (une seule fois : la route est limitée en débit), puis sondage par id. */
function useResolvedTournament(code: string) {
  const [initial, setInitial] = useState<TournamentView | null>(null);
  const [error, setError] = useState<"notFound" | "failed" | "limited" | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/t/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) throw new Error("notFound");
        if (response.status === 429) throw new Error("limited");
        if (!response.ok) throw new Error("failed");
        const body = (await response.json()) as TournamentView;
        if (!cancelled) setInitial(body);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message === "notFound" || reason.message === "limited" ? reason.message : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);
  return { initial, error };
}

export function PlayerScreen({ code }: { code: string }) {
  const t = useTranslations();
  const { initial, error } = useResolvedTournament(code);
  const state = useTournamentState(initial?.tournament.id ?? null);
  const view = state.view ?? initial;
  const now = useServerNow(state.offsetMs);

  if (error === "notFound" || state.error === "notFound") return <Centered>{t("tournaments.notFound")}</Centered>;
  if (error === "limited") return <Centered>{t("tournaments.tooManyAttempts")}</Centered>;
  if (!view) return <Centered>{error ? t("tournaments.loadFailed") : t("common.loading")}</Centered>;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[900px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl text-yellow sm:text-3xl">{view.tournament.name}</h1>
          <Tag tone="cyan">{t(`tournaments.statuses.${view.tournament.status}`)}</Tag>
        </div>
        {view.role === "organizer" ? (
          <Link href={{ pathname: "/tournois/[id]", params: { id: view.tournament.id } }} className="text-sm text-cyan underline">
            {t("tournaments.openConsole")}
          </Link>
        ) : null}
        {state.error === "failed" ? <p className="text-xs text-danger">{t("tournaments.offline")}</p> : null}
      </div>
      {view.me ? <PlayerHome view={view} now={now} refresh={state.refresh} /> : <JoinForm code={code} view={view} onJoined={state.refresh} />}
      <FinalStandings view={view} />
      <PublicRound view={view} />
      {view.standings.length ? (
        <section className={panelClass}>
          <h2 className="mb-2 text-lg">{t("tournaments.tabs.standings")}</h2>
          <StandingsTable standings={view.standings} players={view.players} view={view} highlight={view.me?.id} />
        </section>
      ) : null}
    </div>
  );
}

function JoinForm({ code, view, onJoined }: { code: string; view: TournamentView; onJoined: () => Promise<void> }) {
  const t = useTranslations();
  const { user } = useCollection();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const open = view.tournament.registrationOpen && (view.tournament.status === "inscriptions" || view.tournament.status === "suisse");

  async function join(withAccount: boolean) {
    setPending(true);
    setMessage(null);
    try {
      await postJson(`/api/t/${encodeURIComponent(code)}/join`, withAccount && !name.trim() ? {} : { name: name.trim() });
      await onJoined();
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 0 ? t("tournaments.offline") : error instanceof Error ? error.message : t("tournaments.failed"));
    } finally {
      setPending(false);
    }
  }

  if (!open) return <p className={`${panelClass} text-sm text-muted`}>{t("tournaments.registrationClosedHint")}</p>;
  const accountName = user && user.displayName !== "Ma collection" ? user.displayName : null;
  const { maxPlayers } = view.tournament;
  const full = maxPlayers !== null && view.players.filter((player) => player.status === "active").length >= maxPlayers;

  return (
    <form
      className={`${panelClass} flex flex-col gap-3`}
      onSubmit={(event) => {
        event.preventDefault();
        void join(Boolean(user));
      }}
    >
      <h2 className="text-lg">{t("tournaments.joinTitle")}</h2>
      <label className="flex flex-col gap-1">
        <span className="hud-label">{t("tournaments.joinAs")}</span>
        <input
          className={inputClass}
          value={name}
          maxLength={32}
          placeholder={accountName ?? t("tournaments.playerName")}
          onChange={(event) => setName(event.target.value)}
          autoComplete="nickname"
        />
      </label>
      {!user ? <p className="text-xs text-muted">{t("tournaments.guestHint")}</p> : null}
      {full ? <p className="text-xs text-yellow">{t("publicTournaments.fullHint")}</p> : null}
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      <button type="submit" className={`${primaryClass} h-12`} disabled={pending || (!user && !name.trim()) || (Boolean(user) && !accountName && !name.trim())}>
        {user && accountName && !name.trim() ? t("tournaments.joinWithAccount", { name: accountName }) : t("tournaments.joinButton")}
      </button>
    </form>
  );
}

/** Ronde visible la plus récente (publiée, en cours ou clôturée). */
function visibleRound(view: TournamentView): RoundView | null {
  const rounds = view.rounds.filter((round) => round.status !== "draft");
  return rounds.length ? rounds[rounds.length - 1] : null;
}

function PlayerHome({ view, now, refresh }: { view: TournamentView; now: Date; refresh: () => Promise<void> }) {
  const t = useTranslations();
  const me = view.me!;
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const round = visibleRound(view);
  const match = round?.matches.find((candidate) => candidate.playerAId === me.id || candidate.playerBId === me.id) ?? null;
  const started = view.rounds.some((candidate) => candidate.status === "running" || candidate.status === "closed");
  const finished = view.tournament.status === "termine" || view.tournament.status === "annule";

  async function send(command: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    try {
      await postJson(`/api/tournaments/${view.tournament.id}/player`, command);
      await refresh();
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 0 ? t("tournaments.offline") : error instanceof Error ? error.message : t("tournaments.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`${panelClass} flex flex-col gap-3`}>
      <p className="text-sm">
        <span className="hud-label mr-2">{t("tournaments.you")}</span>
        <span className="text-lg">{me.name}</span>
      </p>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      {me.status === "pending" ? <p className="text-sm text-yellow">{t("tournaments.waitingApproval")}</p> : null}
      {me.status === "waitlist" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-yellow">{t("publicTournaments.waitlistPosition", { n: me.waitlistPosition ?? 1 })}</p>
          <p className="text-xs text-muted">{t("publicTournaments.waitlistHint")}</p>
          {!finished ? (
            <button type="button" className={`${buttonClass} self-start`} disabled={pending} onClick={() => void send({ type: "withdraw" })}>
              {t("publicTournaments.leaveWaitlist")}
            </button>
          ) : null}
        </div>
      ) : null}
      {me.status === "dropped" ? <p className="text-sm text-muted">{t("tournaments.droppedHint")}</p> : null}
      {me.status === "dq" ? <p className="text-sm text-danger">{t("tournaments.dqHint")}</p> : null}
      {me.status === "active" && !round && !finished ? <p className="text-sm text-muted">{t("tournaments.waitingStart")}</p> : null}
      {view.tournament.championId === me.id ? <p className="text-lg text-yellow">{t("tournaments.youWon")}</p> : null}

      {round && match ? <MyMatch view={view} round={round} match={match} now={now} pending={pending} send={send} /> : null}
      {round && !match && me.status === "active" && round.status !== "closed" ? <p className="text-sm text-muted">{t("tournaments.notInRound")}</p> : null}

      {!finished && me.status === "active" ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {started ? (
            <button
              type="button"
              className={dangerClass}
              disabled={pending}
              onClick={() => {
                if (window.confirm(t("tournaments.confirmDropMe"))) void send({ type: "drop" });
              }}
            >
              {t("tournaments.dropMe")}
            </button>
          ) : (
            <button type="button" className={buttonClass} disabled={pending} onClick={() => void send({ type: "withdraw" })}>
              {t("tournaments.withdraw")}
            </button>
          )}
        </div>
      ) : null}
      {!finished && me.status === "pending" ? (
        <button type="button" className={buttonClass} disabled={pending} onClick={() => void send({ type: "withdraw" })}>
          {t("tournaments.withdraw")}
        </button>
      ) : null}
    </section>
  );
}

function MyMatch({
  view,
  round,
  match,
  now,
  pending,
  send,
}: {
  view: TournamentView;
  round: RoundView;
  match: MatchView;
  now: Date;
  pending: boolean;
  send: (command: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const me = view.me!;
  const mySide = match.playerAId === me.id ? "A" : "B";
  const opponentId = mySide === "A" ? match.playerBId : match.playerAId;
  const opponent = view.players.find((player) => player.id === opponentId) ?? null;
  const name = (id: string | null) => view.players.find((player) => player.id === id)?.name ?? "?";
  const mine = mySide === "A" ? match.declA : match.declB;
  const theirs = mySide === "A" ? match.declB : match.declA;
  const running = round.status === "running";
  const declare = (result: MatchResult) => void send({ type: "declare", matchId: match.id, result }).then(() => setEditing(false));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">{roundTitle(round, t)}</h2>
        <RoundClockDisplay round={round} now={now} extraSeconds={match.extraSeconds} large />
      </div>
      {round.status === "published" ? <p className="text-sm text-muted">{t("tournaments.roundNotStarted")}</p> : null}

      {match.playerBId === null ? (
        <p className="text-base text-cyan">{t("tournaments.yourBye")}</p>
      ) : (
        <p className="text-base">
          <span className="hud-label mr-2">{t("tournaments.yourTable", { n: match.table })}</span>
          <span className="text-muted">{t("tournaments.vs")}</span> <span className="text-lg text-yellow">{opponent?.name ?? "?"}</span>
          {opponent && !opponent.hasApp ? <Tag>{t("tournaments.paper")}</Tag> : null}
        </p>
      )}

      {match.playerBId !== null && match.status === "valide" ? (
        <p className="text-sm text-cyan">{t("tournaments.validatedScore", { score: scoreLabel(matchResult(match), t) })}</p>
      ) : null}
      {match.status === "conteste" ? <p className="text-sm text-danger">{t("tournaments.contestedHint")}</p> : null}

      {running && match.playerBId !== null && match.status === "declare" && theirs && !mine ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t("tournaments.opponentDeclared", { name: opponent?.name ?? "?", score: scoreLabel(theirs, t) })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${primaryClass} h-12`} disabled={pending} onClick={() => void send({ type: "confirm", matchId: match.id })}>
              {t("tournaments.confirmScore")}
            </button>
            <button type="button" className={`${dangerClass} h-12`} disabled={pending} onClick={() => void send({ type: "refuse", matchId: match.id })}>
              {t("tournaments.refuseScore")}
            </button>
          </div>
        </div>
      ) : null}

      {running && match.playerBId !== null && match.status === "declare" && mine && !editing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            {scoreLabel(mine, t)} · {match.confirmedOnSite ? t("tournaments.waitingOrganizer") : t("tournaments.waitingOpponent", { name: opponent?.name ?? "?" })}
          </p>
          {!match.confirmedOnSite ? (
            <>
              {opponent && !opponent.hasApp ? <p className="text-xs text-muted">{t("tournaments.confirmOnSiteHint", { name: opponent.name })}</p> : null}
              <button type="button" className={`${primaryClass} h-12`} disabled={pending} onClick={() => void send({ type: "confirmOnSite", matchId: match.id })}>
                {t("tournaments.confirmOnSite", { name: opponent?.name ?? "?" })}
              </button>
              <button type="button" className={buttonClass} disabled={pending} onClick={() => setEditing(true)}>
                {t("tournaments.editDeclaration")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {running && match.playerBId !== null && (match.status === "en_cours" || editing) ? (
        <div className="flex flex-col gap-2">
          <h3 className="hud-label">{t("tournaments.declareTitle")}</h3>
          <ScorePicker
            matchType={view.tournament.matchType}
            phase={round.phase}
            nameA={name(match.playerAId)}
            nameB={name(match.playerBId)}
            allowId
            allowDoubleLoss={false}
            disabled={pending}
            onPick={declare}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Appariements de la ronde visible, pour tous. */
function PublicRound({ view }: { view: TournamentView }) {
  const t = useTranslations();
  const round = visibleRound(view);
  if (!round) return null;
  const name = (id: string | null) => (id ? (view.players.find((player) => player.id === id)?.name ?? "?") : t("tournaments.bye"));
  return (
    <section className={panelClass}>
      <h2 className="mb-2 text-lg">
        {t("tournaments.pairings")} · {roundTitle(round, t)}
      </h2>
      <ul className="flex flex-col text-sm">
        {round.matches.map((match) => (
          <li key={match.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 ${match.playerAId === view.me?.id || match.playerBId === view.me?.id ? "text-yellow" : ""}`}>
            <span>
              <span className="hud-label mr-2">{t("tournaments.table", { n: match.table })}</span>
              {name(match.playerAId)} <span className="text-muted">{t("tournaments.vs")}</span> {name(match.playerBId)}
            </span>
            <span className="font-mono">{scoreLabel(matchResult(match), t)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
