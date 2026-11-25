// Commandes organisateur : résultats des matchs (saisie, correction, forfait).

import type { OrganizerCommand } from "@/lib/api-schemas";
import { OK, type CommandResult, type CommandWarning, type Ctx } from "./command-context";
import { fail } from "./errors";
import { declareResult, noShowResult, organizerSetResult, resultOf } from "./match-state";
import { saveMatchState, toMatchState, type FullTournament, type RoundRow, type Tx } from "./repository";
import { sameResult } from "./scores";
import { dropPlayer, findMatch, findPlayer, isStarted, matchContext, sideOf, winnerId } from "./service";
import { nextSlot } from "./top-cut";

export async function setResult(
  tx: Tx,
  t: FullTournament,
  command: Extract<OrganizerCommand, { type: "setResult" }>,
  ctx: Ctx,
): Promise<CommandResult> {
  const { round, match } = findMatch(t, command.matchId);
  if (!isStarted(round)) fail("tournaments.roundNotStarted", 409);
  const state = toMatchState(match);
  const mctx = matchContext(t, round, ctx.now);

  // Organisateur qui joue ce match : sa saisie n'est qu'une déclaration de joueur.
  const ownPlayer = t.players.find((player) => player.userId === ctx.userId && sideOf(match, player.id));
  if (ownPlayer) {
    const next = declareResult(state, sideOf(match, ownPlayer.id)!, command.result, mctx);
    await saveMatchState(tx, match, next, { action: "declare", actorUserId: ctx.userId, actorPlayerId: ownPlayer.id });
    return { ok: true, data: { status: next.status } };
  }

  const current = resultOf(state);
  if (
    command.expectedVersion !== undefined &&
    command.expectedVersion !== match.version &&
    current &&
    !sameResult(current, command.result)
  ) {
    fail("tournaments.validatedMeanwhile", 409, { current, proposed: command.result });
  }

  const warnings: CommandWarning[] = [];
  const next = organizerSetResult(state, command.result, mctx);
  const laterRounds = t.rounds.filter((candidate) => candidate.number > round.number);

  if (round.phase === "top_cut" && round.status === "closed") {
    await propagateCutCorrection(tx, t, round, match.id, next);
  } else if (round.phase === "swiss" && laterRounds.length > 0) {
    warnings.push({ type: "correction_after_pairing", matchId: match.id });
  }

  const action = current ? (warnings.length ? "correct_after" : "correct") : "organizer_set";
  await saveMatchState(tx, match, next, { action, actorUserId: ctx.userId });
  return { ok: true, warnings, data: { status: next.status } };
}

/** Correction d'un tour de top cut clôturé : met à jour le tour suivant tant qu'il n'a pas démarré. */
async function propagateCutCorrection(
  tx: Tx,
  t: FullTournament,
  round: RoundRow,
  matchId: string,
  next: ReturnType<typeof organizerSetResult>,
) {
  const match = round.matches.find((candidate) => candidate.id === matchId)!;
  const updated = { ...match, status: next.status, kind: next.kind, gamesA: next.gamesA, gamesB: next.gamesB };
  const newWinner = winnerId(updated);
  const following = t.rounds.find((candidate) => candidate.number === round.number + 1);
  if (!following) {
    // Finale corrigée : le champion change.
    if (round.matches.length === 1) await tx.tournament.update({ where: { id: t.id }, data: { championId: newWinner } });
    return;
  }
  if (isStarted(following)) fail("tournaments.nextRoundStarted", 409);
  if (match.bracketSlot === null || !newWinner) return;
  const target = nextSlot(match.bracketSlot);
  const nextMatch = following.matches.find((candidate) => candidate.bracketSlot === target.slot);
  if (!nextMatch) return;
  await tx.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: target.side === "A" ? { playerAId: newWinner } : { playerBId: newWinner },
  });
}

export async function noShow(
  tx: Tx,
  t: FullTournament,
  command: Extract<OrganizerCommand, { type: "noShow" }>,
  ctx: Ctx,
): Promise<CommandResult> {
  const { round, match } = findMatch(t, command.matchId);
  if (round.status !== "running") fail("tournaments.roundNotRunning", 409);
  const side = sideOf(match, command.absentPlayerId) ?? fail("tournaments.notInMatch", 400);
  const next = noShowResult(toMatchState(match), side, matchContext(t, round, ctx.now));
  await saveMatchState(tx, match, next, { action: "no_show", actorUserId: ctx.userId });
  if (command.drop) await dropPlayer(tx, t, findPlayer(t, command.absentPlayerId), { rng: ctx.rng, now: ctx.now });
  return OK;
}
