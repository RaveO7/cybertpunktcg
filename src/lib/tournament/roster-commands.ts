// Commandes organisateur : joueurs (inscription, pseudo, abandon, fusion, lien de reprise).

import { OK, draftWarning, type CommandResult, type Ctx } from "./command-context";
import { playerNameKey } from "./code";
import { fail } from "./errors";
import type { FullTournament, Tx } from "./repository";
import { findPlayer, nextJoinRound, sideOf, startedSwissRounds } from "./service";
import { createToken, hashToken } from "./tokens";

const CLAIM_TTL_MS = 15 * 60_000;

function assertNameFree(t: FullTournament, name: string, exceptId?: string) {
  const key = playerNameKey(name);
  if (t.players.some((player) => player.nameKey === key && player.id !== exceptId)) {
    fail("tournaments.pseudoTaken", 409);
  }
  return key;
}

export function assertRegistrationPhase(t: FullTournament) {
  if (t.status !== "inscriptions" && t.status !== "suisse") fail("tournaments.swissFinished", 409);
}

export async function addPlayer(tx: Tx, t: FullTournament, name: string): Promise<CommandResult> {
  assertRegistrationPhase(t);
  const nameKey = assertNameFree(t, name);
  const joinedRound = nextJoinRound(t);
  const player = await tx.tournamentPlayer.create({
    data: { tournamentId: t.id, name, nameKey, status: "active", joinedRound, missedRounds: joinedRound - 1 },
  });
  return { ok: true, data: { playerId: player.id }, warnings: draftWarning(t) };
}

export async function renamePlayer(tx: Tx, t: FullTournament, playerId: string, name: string): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  const nameKey = assertNameFree(t, name, player.id);
  await tx.tournamentPlayer.update({ where: { id: player.id }, data: { name, nameKey } });
  return OK;
}

export async function approvePlayer(tx: Tx, t: FullTournament, playerId: string): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  if (player.status !== "pending") fail("tournaments.notPending", 409);
  assertRegistrationPhase(t);
  const joinedRound = nextJoinRound(t);
  await tx.tournamentPlayer.update({
    where: { id: player.id },
    data: { status: "active", joinedRound, missedRounds: joinedRound - 1 },
  });
  return { ok: true, warnings: draftWarning(t) };
}

export async function undropPlayer(tx: Tx, t: FullTournament, playerId: string): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  if (player.status === "dq") fail("tournaments.disqualificationFinal", 409);
  if (player.status !== "dropped") fail("tournaments.notDropped", 409);
  if (t.status !== "suisse" && t.status !== "inscriptions") fail("tournaments.swissFinished", 409);
  const started = startedSwissRounds(t);
  const missedSinceDrop = Math.max(0, started - (player.droppedAfterRound ?? started));
  await tx.tournamentPlayer.update({
    where: { id: player.id },
    data: {
      status: "active",
      droppedAfterRound: null,
      // joinedRound reste celui de l'inscription (déjà éligible) : seules les rondes manquées comptent.
      missedRounds: player.missedRounds + missedSinceDrop,
    },
  });
  return { ok: true, warnings: draftWarning(t) };
}

export async function mergePlayers(tx: Tx, t: FullTournament, keepId: string, mergeId: string): Promise<CommandResult> {
  if (keepId === mergeId) fail("tournaments.choosePlayers");
  const keep = findPlayer(t, keepId);
  const merge = findPlayer(t, mergeId);
  const roundsOf = (playerId: string) =>
    new Set(t.rounds.filter((round) => round.matches.some((match) => sideOf(match, playerId))).map((round) => round.number));
  for (const round of t.rounds) {
    for (const match of round.matches) {
      if (sideOf(match, keep.id) && sideOf(match, merge.id)) fail("tournaments.mergeOpponents", 409);
    }
  }
  const keepRounds = roundsOf(keep.id);
  for (const number of roundsOf(merge.id)) {
    if (keepRounds.has(number)) fail("tournaments.mergeSameRound", 409);
  }

  // Le lien (compte, appareil) le plus récent l'emporte.
  const [older, newer] = keep.createdAt <= merge.createdAt ? [keep, merge] : [merge, keep];
  const userId = newer.userId ?? older.userId;
  const deviceTokenHash = newer.deviceTokenHash ?? older.deviceTokenHash;

  await tx.tournamentPlayer.update({
    where: { id: merge.id },
    data: { userId: null, deviceTokenHash: null, claimTokenHash: null },
  });
  await tx.tournamentMatch.updateMany({ where: { playerAId: merge.id, round: { tournamentId: t.id } }, data: { playerAId: keep.id } });
  await tx.tournamentMatch.updateMany({ where: { playerBId: merge.id, round: { tournamentId: t.id } }, data: { playerBId: keep.id } });
  await tx.tournamentPlayer.delete({ where: { id: merge.id } });
  await tx.tournamentPlayer.update({
    where: { id: keep.id },
    data: {
      userId,
      deviceTokenHash,
      status: keep.status === "active" || merge.status === "active" ? "active" : keep.status,
      joinedRound: Math.min(keep.joinedRound, merge.joinedRound),
      missedRounds: Math.min(keep.missedRounds, merge.missedRounds),
    },
  });
  return { ok: true, data: { playerId: keep.id }, warnings: draftWarning(t) };
}

export async function issueClaim(tx: Tx, t: FullTournament, playerId: string, ctx: Ctx): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  const token = createToken();
  const expiresAt = new Date(ctx.now.getTime() + CLAIM_TTL_MS);
  await tx.tournamentPlayer.update({
    where: { id: player.id },
    data: { claimTokenHash: hashToken(token), claimExpiresAt: expiresAt },
  });
  return { ok: true, data: { token, expiresAt: expiresAt.toISOString() } };
}
