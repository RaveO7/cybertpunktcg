"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { formatClock, remainingSeconds } from "@/lib/tournament/clock";
import type { MatchResult } from "@/lib/tournament/scores";
import type { Standing } from "@/lib/tournament/standings";
import type { MatchView, PlayerView, RoundView, TournamentView } from "@/lib/tournament/view";

export const buttonClass =
  "inline-flex h-10 items-center justify-center gap-1.5 border border-line px-3 text-sm text-muted transition hover:border-cyan hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 disabled:opacity-50";
export const primaryClass =
  "inline-flex h-10 items-center justify-center bg-yellow px-4 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50";
export const dangerClass =
  "inline-flex h-10 items-center justify-center gap-1.5 border border-danger/60 px-3 text-sm text-danger transition hover:bg-danger/10 disabled:opacity-50";
export const inputClass =
  "h-10 w-full min-w-0 border border-line bg-background px-3 text-sm outline-none focus:border-cyan";
export const panelClass = "border border-line bg-panel p-3 sm:p-4";

/** QR code (SVG) d'une URL : modules noirs sur fond blanc, pour un scan fiable. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-64 bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export function absoluteUrl(path: string) {
  return typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
}

export function scoreLabel(result: Pick<MatchResult, "gamesA" | "gamesB" | "kind"> | null, t: ReturnType<typeof useI18n>["t"]) {
  if (!result) return "—";
  if (result.kind === "double_loss") return t.tournaments.doubleLoss;
  if (result.kind === "id") return t.tournaments.intentionalDraw;
  if (result.kind === "bye") return t.tournaments.bye;
  return `${result.gamesA}-${result.gamesB}`;
}

export function matchResult(match: MatchView): MatchResult | null {
  if (match.status !== "valide" || match.gamesA === null || match.gamesB === null) return null;
  return { kind: match.kind, gamesA: match.gamesA, gamesB: match.gamesB };
}

/** Scores proposés, du point de vue du joueur A. */
export function scoreOptions(matchType: "bo1" | "bo3", phase: RoundView["phase"]): [number, number][] {
  const all: [number, number][] =
    matchType === "bo3"
      ? [[2, 0], [2, 1], [1, 0], [1, 1], [0, 0], [0, 1], [1, 2], [0, 2]]
      : [[1, 0], [0, 0], [0, 1]];
  return phase === "top_cut" ? all.filter(([a, b]) => a !== b) : all;
}

/** Choix rapide d'un score : un bouton par score possible, plus ID et double défaite si permis. */
export function ScorePicker({
  matchType,
  phase,
  nameA,
  nameB,
  allowId,
  allowDoubleLoss,
  disabled,
  onPick,
}: {
  matchType: "bo1" | "bo3";
  phase: RoundView["phase"];
  nameA: string;
  nameB: string;
  allowId: boolean;
  allowDoubleLoss: boolean;
  disabled?: boolean;
  onPick: (result: MatchResult) => void;
}) {
  const { t } = useI18n();
  const swiss = phase === "swiss";
  return (
    <div className="flex flex-col gap-2">
      <p className="hud-label">
        {nameA} — {nameB}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {scoreOptions(matchType, phase).map(([gamesA, gamesB]) => (
          <button
            key={`${gamesA}-${gamesB}`}
            type="button"
            disabled={disabled}
            className={`${buttonClass} h-11 min-w-14 font-mono text-base ${gamesA > gamesB ? "text-cyan" : gamesB > gamesA ? "text-yellow" : ""}`}
            title={gamesA > gamesB ? t.tournaments.wins(nameA) : gamesB > gamesA ? t.tournaments.wins(nameB) : t.tournaments.draw}
            onClick={() => onPick({ kind: "normal", gamesA, gamesB })}
          >
            {gamesA}-{gamesB}
          </button>
        ))}
        {swiss && allowId ? (
          <button type="button" disabled={disabled} className={`${buttonClass} h-11`} onClick={() => onPick({ kind: "id", gamesA: 0, gamesB: 0 })}>
            {t.tournaments.intentionalDraw}
          </button>
        ) : null}
        {swiss && allowDoubleLoss ? (
          <button
            type="button"
            disabled={disabled}
            className={`${buttonClass} h-11`}
            onClick={() => onPick({ kind: "double_loss", gamesA: 0, gamesB: 0 })}
          >
            {t.tournaments.doubleLoss}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Chrono d'une ronde, à l'heure du serveur ; `extraSeconds` = temps en plus d'une table. */
export function RoundClockDisplay({ round, now, extraSeconds = 0, large = false }: { round: RoundView; now: Date; extraSeconds?: number; large?: boolean }) {
  const { t } = useI18n();
  if (round.status !== "running" || !round.startedAt) return null;
  const remaining = remainingSeconds(
    {
      startedAt: new Date(round.startedAt),
      durationSeconds: round.durationSeconds,
      pausedAt: round.pausedAt ? new Date(round.pausedAt) : null,
      pausedSeconds: round.pausedSeconds,
      addedSeconds: round.addedSeconds,
    },
    now,
    extraSeconds,
  );
  const over = remaining <= 0;
  return (
    <div className="flex items-baseline gap-2" role="timer" aria-live="off">
      <span className={`font-mono tabular-nums ${large ? "text-4xl sm:text-5xl" : "text-2xl"} ${over ? "text-danger" : "text-cyan"}`}>
        {over ? t.tournaments.timeUp : formatClock(remaining)}
      </span>
      {round.pausedAt ? <span className="hud-label text-yellow">{t.tournaments.paused}</span> : null}
      {extraSeconds > 0 ? <span className="hud-label">{t.tournaments.extraTime(Math.round(extraSeconds / 60))}</span> : null}
    </div>
  );
}

export function percent(value: number) {
  return `${(value * 100).toFixed(1)}`;
}

export function StandingsTable({
  standings,
  players,
  view,
  highlight,
}: {
  standings: Standing[];
  players: PlayerView[];
  view: TournamentView;
  highlight?: string | null;
}) {
  const { t } = useI18n();
  const byId = new Map(players.map((player) => [player.id, player]));
  const drawn = new Set(view.tournament.cutDraws.flatMap((draw) => draw.tied));
  const seeds = new Set(view.tournament.cutSeeds);
  if (standings.length === 0) return <p className="text-sm text-muted">{t.tournaments.noPlayers}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="hud-label text-left">
            <th className="px-2 py-2">{t.tournaments.rank}</th>
            <th className="px-2 py-2">{t.tournaments.playerName}</th>
            <th className="px-2 py-2 text-right">{t.tournaments.points}</th>
            <th className="px-2 py-2 text-right">{t.tournaments.record}</th>
            <th className="px-2 py-2 text-right">{t.tournaments.omw}</th>
            <th className="px-2 py-2 text-right">{t.tournaments.gw}</th>
            <th className="px-2 py-2 text-right">{t.tournaments.ogw}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const player = byId.get(row.playerId);
            return (
              <tr key={row.playerId} className={`border-t border-line ${row.playerId === highlight ? "bg-panel-2" : ""}`}>
                <td className="px-2 py-2 font-mono">{row.rank}</td>
                <td className="px-2 py-2">
                  <span className="mr-2">{row.name}</span>
                  {row.status === "dropped" ? <Tag tone="muted">{t.tournaments.dropped}</Tag> : null}
                  {row.status === "dq" ? <Tag tone="danger">{t.tournaments.dq}</Tag> : null}
                  {seeds.has(row.playerId) ? <Tag tone="cyan">{t.tournaments.qualified}</Tag> : null}
                  {player?.cutDeclined ? <Tag tone="muted">{t.tournaments.declinedCut}</Tag> : null}
                  {drawn.has(row.playerId) && seeds.has(row.playerId) ? <Tag tone="yellow">{t.tournaments.tiedByDraw}</Tag> : null}
                </td>
                <td className="px-2 py-2 text-right font-mono">{row.points}</td>
                <td className="px-2 py-2 text-right font-mono">
                  {row.wins}-{row.draws}-{row.losses}
                </td>
                <td className="px-2 py-2 text-right font-mono">{percent(row.omwPct)}</td>
                <td className="px-2 py-2 text-right font-mono">{percent(row.gwPct)}</td>
                <td className="px-2 py-2 text-right font-mono">{percent(row.ogwPct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "cyan" | "yellow" | "danger" }) {
  const colors = {
    muted: "border-line text-muted",
    cyan: "border-cyan/60 text-cyan",
    yellow: "border-yellow/60 text-yellow",
    danger: "border-danger/60 text-danger",
  };
  return <span className={`mr-1 inline-flex h-5 items-center border px-1.5 text-[11px] ${colors[tone]}`}>{children}</span>;
}

/** Libellé d'un tour de top cut selon son nombre de matchs. */
export function roundTitle(round: Pick<RoundView, "phase" | "number" | "matches">, t: ReturnType<typeof useI18n>["t"]) {
  if (round.phase === "swiss") return t.tournaments.roundTitle(round.number);
  return t.tournaments.cutRoundTitle(round.matches.length);
}

export function FinalStandings({ view }: { view: TournamentView }) {
  const { t } = useI18n();
  if (!view.finalStandings) return null;
  return (
    <section className={panelClass}>
      <h2 className="mb-2 text-lg text-yellow">{t.tournaments.finalStandings}</h2>
      <ol className="flex flex-col gap-1 text-sm">
        {view.finalStandings.map((row) => (
          <li key={row.playerId} className="flex items-center gap-2">
            <span className="w-8 font-mono text-muted">{row.finalRank}</span>
            <span>{row.name}</span>
            {row.champion ? <Tag tone="yellow">{t.tournaments.champion}</Tag> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
