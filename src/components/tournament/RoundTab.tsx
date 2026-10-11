"use client";

import { useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import type { QueuedCommand } from "@/lib/tournament/offline-queue";
import type { MatchResult } from "@/lib/tournament/scores";
import type { MatchView, RoundView, TournamentView } from "@/lib/tournament/view";
import type { RunCommand } from "./TournamentConsole";
import {
  buttonClass,
  dangerClass,
  FinalStandings,
  matchResult,
  panelClass,
  primaryClass,
  RoundClockDisplay,
  roundTitle,
  scoreLabel,
  ScorePicker,
  Tag,
} from "./ui";

/** Ordre d'urgence pour le TO : contestés, en attente trop longue, à saisir, déclarés, en cours, validés. */
function urgency(match: MatchView, hasApp: (id: string | null) => boolean) {
  if (match.status === "conteste") return 0;
  if (match.overdue) return 1;
  if (match.status === "en_cours" && !hasApp(match.playerAId) && !hasApp(match.playerBId)) return 2;
  if (match.status === "declare") return 3;
  if (match.status === "en_cours") return 4;
  return 5;
}

export function RoundTab({ view, run, now, pending }: { view: TournamentView; run: RunCommand; now: Date; pending: QueuedCommand[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const status = view.tournament.status;
  const current = view.rounds.length ? view.rounds[view.rounds.length - 1] : null;
  const names = new Map(view.players.map((player) => [player.id, player.name]));
  const apps = new Map(view.players.map((player) => [player.id, player.hasApp]));
  const name = (id: string | null) => (id ? (names.get(id) ?? "?") : t.tournaments.bye);
  const hasApp = (id: string | null) => (id ? (apps.get(id) ?? false) : false);
  const swissPlayed = view.rounds.filter((round) => round.phase === "swiss").length;
  const notStarted = current !== null && (current.status === "draft" || current.status === "published");
  const canPairNext =
    (status === "inscriptions" || status === "suisse") && (!current || current.status === "closed") && swissPlayed < view.tournament.swissRounds;
  const queuedResults = new Map<string, MatchResult>();
  for (const item of pending) {
    if (item.command.type === "setResult") queuedResults.set(item.command.matchId as string, item.command.result as MatchResult);
  }

  async function start(extra: Record<string, boolean> = {}) {
    const outcome = await run({ type: "startRound", ...extra });
    if (outcome.status !== "error") return;
    const details = (outcome.details ?? {}) as { needs?: string; active?: number; pending?: number };
    if (details.needs === "fewPlayers" && window.confirm(t.tournaments.confirmFewPlayers(details.active ?? 0))) {
      await start({ ...extra, confirmFewPlayers: true });
    } else if (details.needs === "pending" && window.confirm(t.tournaments.confirmPending(details.pending ?? 0))) {
      await start({ ...extra, ignorePending: true });
    }
  }

  async function pick(playerId: string) {
    if (!current || !notStarted || current.phase !== "swiss") return;
    if (!selected) {
      setSelected(playerId);
      return;
    }
    if (selected !== playerId) await run({ type: "swapPlayers", playerA: selected, playerB: playerId });
    setSelected(null);
  }

  if (status === "termine" || status === "annule") {
    return (
      <div className="flex flex-col gap-3">
        {status === "annule" ? <p className={`${panelClass} text-sm text-danger`}>{t.tournaments.statuses.annule}</p> : null}
        {view.tournament.championId ? (
          <p className={`${panelClass} text-lg`}>
            <span className="hud-label mr-2">{t.tournaments.champion}</span>
            <span className="text-yellow">{name(view.tournament.championId)}</span>
          </p>
        ) : null}
        <FinalStandings view={view} />
        <History rounds={view.rounds} view={view} run={run} now={now} name={name} queued={queuedResults} open />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canPairNext ? (
        <button type="button" className={`${primaryClass} h-12`} onClick={() => void run({ type: "pairRound" })}>
          {t.tournaments.pairRound(swissPlayed + 1)}
        </button>
      ) : null}
      {!current ? <p className="text-sm text-muted">{t.tournaments.noRound}</p> : null}

      {current ? (
        <section className={`${panelClass} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">
              {roundTitle(current, t)} <Tag tone={current.status === "running" ? "cyan" : "muted"}>{t.tournaments.roundStatuses[current.status]}</Tag>
            </h2>
            <RoundClockDisplay round={current} now={now} large />
          </div>

          {notStarted ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} onClick={() => void run({ type: "pairRound" })}>
                {t.tournaments.repair}
              </button>
              {current.status === "draft" ? (
                <button type="button" className={buttonClass} onClick={() => void run({ type: "publishRound" })}>
                  {t.tournaments.publish}
                </button>
              ) : null}
              <button type="button" className={primaryClass} onClick={() => void start()}>
                {t.tournaments.start}
              </button>
            </div>
          ) : null}
          {notStarted && current.phase === "swiss" ? <p className="text-xs text-muted">{selected ? t.tournaments.swapHint : t.tournaments.swapIntro}</p> : null}
          {notStarted && current.phase === "top_cut" ? <CutSeeds view={view} run={run} name={name} /> : null}

          {current.status === "running" ? (
            <div className="flex flex-wrap gap-2">
              {current.pausedAt ? (
                <button type="button" className={buttonClass} onClick={() => void run({ type: "resumeClock" })}>
                  {t.tournaments.resume}
                </button>
              ) : (
                <button type="button" className={buttonClass} onClick={() => void run({ type: "pauseClock" })}>
                  {t.tournaments.pause}
                </button>
              )}
              {[-1, 1, 5].map((minutes) => (
                <button key={minutes} type="button" className={buttonClass} onClick={() => void run({ type: "adjustClock", seconds: minutes * 60 })}>
                  {minutes > 0 ? t.tournaments.addMinutes(minutes) : t.tournaments.removeMinutes(-minutes)}
                </button>
              ))}
            </div>
          ) : null}

          <ul className="flex flex-col border-t border-line">
            {[...current.matches]
              .sort((x, y) => (current.status === "running" ? urgency(x, hasApp) - urgency(y, hasApp) : 0) || x.table - y.table)
              .map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  round={current}
                  view={view}
                  run={run}
                  now={now}
                  name={name}
                  hasApp={hasApp}
                  queued={queuedResults.get(match.id) ?? null}
                  selected={selected}
                  onPick={notStarted && current.phase === "swiss" ? (id) => void pick(id) : null}
                  onGiveBye={
                    notStarted && current.phase === "swiss" && selected && current.matches.some((candidate) => candidate.playerBId === null)
                      ? async () => {
                          await run({ type: "moveBye", playerId: selected });
                          setSelected(null);
                        }
                      : null
                  }
                />
              ))}
          </ul>

          {current.status === "running" ? (
            <CloseRound round={current} run={run} />
          ) : null}
        </section>
      ) : null}

      {view.rounds.some((round) => round.status === "closed") ? (
        <div className="flex flex-col gap-2">
          <button type="button" className={buttonClass} aria-expanded={showHistory} onClick={() => setShowHistory((value) => !value)}>
            {t.tournaments.history}
          </button>
          {showHistory ? <History rounds={view.rounds.filter((round) => round.status === "closed")} view={view} run={run} now={now} name={name} queued={queuedResults} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function CloseRound({ round, run }: { round: RoundView; run: RunCommand }) {
  const { t } = useI18n();
  const open = round.matches.filter((match) => match.status !== "valide").length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={`${primaryClass} h-12`} onClick={() => void run({ type: "closeRound" })}>
        {t.tournaments.closeRound}
      </button>
      {open > 0 ? <span className="text-sm text-muted">{t.tournaments.remainingMatches(open)}</span> : null}
    </div>
  );
}

/** Qualifiés du top cut (premier tour pas encore démarré) : un qualifié peut décliner. */
function CutSeeds({ view, run, name }: { view: TournamentView; run: RunCommand; name: (id: string | null) => string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1">
      {view.tournament.cutSeeds.map((id, index) => (
        <div key={id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            <span className="mr-2 font-mono text-muted">{index + 1}</span>
            {name(id)}
          </span>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              if (window.confirm(t.tournaments.confirmDecline(name(id)))) void run({ type: "declineCut", playerId: id });
            }}
          >
            {t.tournaments.declineCut}
          </button>
        </div>
      ))}
    </div>
  );
}

function History({
  rounds,
  view,
  run,
  now,
  name,
  queued,
  open = false,
}: {
  rounds: RoundView[];
  view: TournamentView;
  run: RunCommand;
  now: Date;
  name: (id: string | null) => string;
  queued: Map<string, MatchResult>;
  open?: boolean;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(open && rounds.length ? rounds[rounds.length - 1].id : null);
  return (
    <div className="flex flex-col gap-2">
      {[...rounds].reverse().map((round) => (
        <section key={round.id} className={panelClass}>
          <button type="button" className="flex w-full items-center justify-between text-left" aria-expanded={expanded === round.id} onClick={() => setExpanded((current) => (current === round.id ? null : round.id))}>
            <span>{roundTitle(round, t)}</span>
            <span aria-hidden="true">{expanded === round.id ? "−" : "+"}</span>
          </button>
          {expanded === round.id ? (
            <ul className="mt-2 flex flex-col border-t border-line">
              {round.matches.map((match) => (
                <MatchRow key={match.id} match={match} round={round} view={view} run={run} now={now} name={name} hasApp={() => true} queued={queued.get(match.id) ?? null} selected={null} onPick={null} onGiveBye={null} />
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function MatchRow({
  match,
  round,
  view,
  run,
  now,
  name,
  hasApp,
  queued,
  selected,
  onPick,
  onGiveBye,
}: {
  match: MatchView;
  round: RoundView;
  view: TournamentView;
  run: RunCommand;
  now: Date;
  name: (id: string | null) => string;
  hasApp: (id: string | null) => boolean;
  queued: MatchResult | null;
  selected: string | null;
  onPick: ((playerId: string) => void) | null;
  onGiveBye: (() => Promise<void>) | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [dropAbsent, setDropAbsent] = useState(false);
  const isBye = match.playerBId === null;
  const editable = !isBye && (round.status === "running" || round.status === "closed");
  const declared = match.declA ?? match.declB;
  const result = matchResult(match);

  const status = (
    <span className="flex flex-wrap items-center gap-1">
      {queued ? <Tag tone="danger">{t.tournaments.notSynced}</Tag> : null}
      {match.status === "conteste" ? <Tag tone="danger">{t.tournaments.matchStatuses.conteste}</Tag> : null}
      {match.overdue ? <Tag tone="yellow">{t.tournaments.overdue}</Tag> : null}
      {match.status === "declare" ? <Tag tone="yellow">{t.tournaments.matchStatuses.declare}</Tag> : null}
      {match.status === "declare" && match.confirmedOnSite ? <Tag>{t.tournaments.onSite}</Tag> : null}
      {match.status === "en_cours" && round.status === "running" && !hasApp(match.playerAId) && !hasApp(match.playerBId) ? <Tag>{t.tournaments.toEnter}</Tag> : null}
      {match.kind === "no_show" ? <Tag>{t.tournaments.noShow}</Tag> : null}
      {match.extraSeconds > 0 ? <Tag tone="cyan">{t.tournaments.extraTime(Math.round(match.extraSeconds / 60))}</Tag> : null}
    </span>
  );

  const playerButton = (id: string | null) =>
    onPick && id ? (
      <button type="button" className={`border px-2 py-1 ${selected === id ? "border-yellow text-yellow" : "border-line"}`} onClick={() => onPick(id)}>
        {name(id)}
      </button>
    ) : (
      <span>{name(id)}</span>
    );

  return (
    <li className="border-b border-line py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="hud-label w-14 shrink-0">{t.tournaments.table(match.table)}</span>
          {playerButton(match.playerAId)}
          <span className="text-muted">{t.tournaments.vs}</span>
          {isBye ? (
            onGiveBye ? (
              <button type="button" className={`${buttonClass} h-8`} onClick={() => void onGiveBye()}>
                {t.tournaments.giveBye}
              </button>
            ) : (
              <span className="text-muted">{t.tournaments.bye}</span>
            )
          ) : (
            playerButton(match.playerBId)
          )}
        </div>
        <div className="flex items-center gap-2">
          {status}
          <span className="font-mono">{queued ? scoreLabel(queued, t) : scoreLabel(result, t)}</span>
          {editable ? (
            <button type="button" className={`${buttonClass} h-9`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? t.tournaments.close : t.tournaments.setScore}
            </button>
          ) : null}
        </div>
      </div>

      {open && editable ? (
        <div className="mt-3 flex flex-col gap-3">
          {match.declA || match.declB ? (
            <p className="text-sm text-muted">
              {match.declA ? `${name(match.playerAId)} : ${scoreLabel(match.declA, t)}` : null}
              {match.declA && match.declB ? " · " : null}
              {match.declB ? `${name(match.playerBId)} : ${scoreLabel(match.declB, t)}` : null}
            </p>
          ) : null}
          {match.status === "declare" && declared ? (
            <button
              type="button"
              className={primaryClass}
              onClick={() => void run({ type: "setResult", matchId: match.id, result: declared, expectedVersion: match.version }).then(() => setOpen(false))}
            >
              {t.tournaments.validateDeclared(scoreLabel(declared, t))}
            </button>
          ) : null}
          <ScorePicker
            matchType={view.tournament.matchType}
            phase={round.phase}
            nameA={name(match.playerAId)}
            nameB={name(match.playerBId)}
            allowId
            allowDoubleLoss
            onPick={(picked) => void run({ type: "setResult", matchId: match.id, result: picked, expectedVersion: match.version }).then(() => setOpen(false))}
          />
          {round.status === "running" ? (
            <div className="flex flex-wrap items-center gap-2">
              {[match.playerAId, match.playerBId!].map((id) => (
                <button
                  key={id}
                  type="button"
                  className={dangerClass}
                  onClick={() => {
                    if (!window.confirm(t.tournaments.noShowConfirm(name(id)))) return;
                    void run({ type: "noShow", matchId: match.id, absentPlayerId: id, drop: dropAbsent }).then(() => setOpen(false));
                  }}
                >
                  {t.tournaments.noShowOf(name(id))}
                </button>
              ))}
              <label className="flex items-center gap-1 text-sm text-muted">
                <input type="checkbox" checked={dropAbsent} onChange={(event) => setDropAbsent(event.target.checked)} />
                {t.tournaments.alsoDrop}
              </label>
            </div>
          ) : null}
          {round.status === "running" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="hud-label">{t.tournaments.tableTime}</span>
              {[2, 5].map((minutes) => (
                <button key={minutes} type="button" className={buttonClass} onClick={() => void run({ type: "addTableTime", matchId: match.id, seconds: minutes * 60 })}>
                  {t.tournaments.addMinutes(minutes)}
                </button>
              ))}
              <RoundClockDisplay round={round} now={now} extraSeconds={match.extraSeconds} />
              {match.status !== "en_cours" ? (
                <button type="button" className={buttonClass} onClick={() => void run({ type: "resetResult", matchId: match.id })}>
                  {t.tournaments.resetResult}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
