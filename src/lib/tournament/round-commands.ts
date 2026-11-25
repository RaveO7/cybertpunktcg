// Commandes organisateur : rondes (appariement, démarrage, chrono, clôture, top cut).

import type { OrganizerCommand } from "@/lib/api-schemas";
import { OK, type CommandResult, type Ctx } from "./command-context";
import { roundDurationSeconds, type RoundClock } from "./clock";
import { fail } from "./errors";
import { pairingWarnings, type PairedMatch } from "./pairing";
import type { FullTournament, Tx } from "./repository";
import type { Phase } from "./scores";
import {
  advanceCut,
  cutStillOpen,
  deleteDraftRound,
  eligiblePlayers,
  endSwiss,
  isStarted,
  lastRound,
  pairingPlayers,
  pairSwiss,
  pendingRound,
  readCut,
  rebuildCut,
  rewriteRoundMatches,
  roundIsUpToDate,
} from "./service";

export async function pairRound(tx: Tx, t: FullTournament, ctx: Ctx): Promise<CommandResult> {
  if (t.status === "top_cut") {
    // Top cut : recompose le premier tour tant qu'il n'a pas démarré (les tours suivants sont automatiques).
    if (!cutStillOpen(t)) fail("tournaments.topCutAutoPaired", 409);
    await rebuildCut(tx, t, ctx.rng, ctx.now);
    return OK;
  }
  const last = lastRound(t);
  if (last?.status === "running") fail("tournaments.roundNotClosed", 409);
  let number = (last?.number ?? 0) + 1;
  if (last && !isStarted(last)) {
    // Relancer l'appariement : la ronde non démarrée est remplacée.
    await deleteDraftRound(tx, last);
    number = last.number;
  }
  if (number > t.swissRounds) fail("tournaments.allSwissPlayed", 409);
  const view: FullTournament = last && !isStarted(last) ? { ...t, rounds: t.rounds.slice(0, -1) } : t;
  const { roundId, warnings } = await pairSwiss(tx, view, number, ctx.rng);
  return { ok: true, data: { roundId }, warnings };
}

export async function editPairing(tx: Tx, t: FullTournament, edit: (matches: PairedMatch[]) => PairedMatch[]): Promise<CommandResult> {
  const round = pendingRound(t) ?? fail("tournaments.pairingsLocked", 409);
  if (round.phase !== "swiss") fail("tournaments.bracketFollowsStandings", 409);
  const current = round.matches.map((match) => ({ a: match.playerAId, b: match.playerBId }));
  const next = edit(current);
  await rewriteRoundMatches(tx, t, round, next);
  const ids = new Set(next.flatMap((match) => (match.b ? [match.a, match.b] : [match.a])));
  const before: FullTournament = { ...t, rounds: t.rounds.filter((candidate) => candidate.id !== round.id) };
  return { ok: true, warnings: round.number > 1 ? pairingWarnings(next, pairingPlayers(before, ids)) : [] };
}

export async function startRound(
  tx: Tx,
  t: FullTournament,
  command: Extract<OrganizerCommand, { type: "startRound" }>,
  ctx: Ctx,
): Promise<CommandResult> {
  const round = pendingRound(t) ?? fail("tournaments.noRoundToStart", 409);
  if (round.phase === "swiss" && round.number === 1) {
    const pending = t.players.filter((player) => player.status === "pending").length;
    if (pending > 0 && !command.ignorePending) {
      fail("tournaments.pendingRegistrations", 409, { needs: "pending", pending }, { count: pending });
    }
    const active = eligiblePlayers(t, 1).length;
    if (active < 2) fail("tournaments.needTwoActivePlayers", 409);
    if (active < 4 && !command.confirmFewPlayers) {
      fail("tournaments.confirmFewPlayers", 409, { needs: "fewPlayers", active });
    }
  }
  if (!roundIsUpToDate(t, round)) fail("tournaments.registrationsChanged", 409);
  await tx.tournamentRound.update({
    where: { id: round.id },
    data: {
      status: "running",
      startedAt: ctx.now,
      pausedAt: null,
      pausedSeconds: 0,
      addedSeconds: 0,
      durationSeconds: roundDurationSeconds(round.phase as Phase, t.roundMinutes, t.topCutExtraMinutes),
    },
  });
  if (t.status === "inscriptions") await tx.tournament.update({ where: { id: t.id }, data: { status: "suisse" } });
  return OK;
}

export async function updateClock(tx: Tx, t: FullTournament, change: (clock: RoundClock) => RoundClock): Promise<CommandResult> {
  const round = lastRound(t);
  if (!round || round.status !== "running") fail("tournaments.noRunningRound", 409);
  const next = change({
    startedAt: round.startedAt,
    durationSeconds: round.durationSeconds,
    pausedAt: round.pausedAt,
    pausedSeconds: round.pausedSeconds,
    addedSeconds: round.addedSeconds,
  });
  await tx.tournamentRound.update({
    where: { id: round.id },
    data: { pausedAt: next.pausedAt, pausedSeconds: next.pausedSeconds, addedSeconds: next.addedSeconds },
  });
  return OK;
}

export async function closeRound(tx: Tx, t: FullTournament, ctx: Ctx): Promise<CommandResult> {
  const round = lastRound(t);
  if (!round || round.status !== "running") fail("tournaments.noRunningRound", 409);
  const open = round.matches.filter((match) => match.status !== "valide");
  if (open.length > 0) {
    fail("tournaments.openMatches", 409, { matchIds: open.map((match) => match.id) }, { count: open.length });
  }
  await tx.tournamentRound.update({ where: { id: round.id }, data: { status: "closed" } });
  const closed: FullTournament = {
    ...t,
    rounds: t.rounds.map((candidate) => (candidate.id === round.id ? { ...candidate, status: "closed" } : candidate)),
  };
  if (round.phase === "top_cut") {
    const { status } = await advanceCut(tx, closed, { ...round, status: "closed" });
    return { ok: true, data: { status } };
  }
  const closedSwiss = closed.rounds.filter((candidate) => candidate.phase === "swiss" && candidate.status === "closed").length;
  if (closedSwiss >= t.swissRounds) {
    const { status } = await endSwiss(tx, closed, ctx.rng, ctx.now);
    return { ok: true, data: { status } };
  }
  return { ok: true, data: { status: t.status } };
}

export async function declineCut(tx: Tx, t: FullTournament, playerId: string, ctx: Ctx): Promise<CommandResult> {
  if (!cutStillOpen(t)) fail("tournaments.topCutStarted", 409);
  const cut = readCut(t);
  if (!cut?.seeds.includes(playerId)) fail("tournaments.notQualified", 409);
  await tx.tournamentPlayer.update({ where: { id: playerId }, data: { cutDeclined: true } });
  await rebuildCut(tx, t, ctx.rng, ctx.now);
  return OK;
}
