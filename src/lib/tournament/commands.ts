// Commandes organisateur (TO et co-organisateurs). Point d'entrée unique et idempotent :
// une commande déjà appliquée (même clientActionId) renvoie le résultat enregistré, ce qui
// permet à la file hors connexion de renvoyer sans risque de double effet.

import { Prisma } from "@prisma/client";
import type { OrganizerCommand } from "@/lib/api-schemas";
import { prisma } from "@/lib/prisma";
import { adjustClock, pauseClock, resumeClock, roundDurationSeconds, type RoundClock } from "./clock";
import { generateTournamentCode, playerNameKey } from "./code";
import { fail, TournamentError } from "./errors";
import {
  declareResult,
  noShowResult,
  organizerSetResult,
  resetResult,
  resultOf,
} from "./match-state";
import { moveBye, pairingWarnings, swapPlayers, type PairedMatch, type PairingWarning } from "./pairing";
import { cryptoRng, type Rng } from "./random";
import { saveMatchState, toMatchState, writeTournament, type FullTournament, type RoundRow, type Tx } from "./repository";
import { sameResult, type Phase } from "./scores";
import {
  advanceCut,
  cutStillOpen,
  deleteDraftRound,
  dropPlayer,
  eligiblePlayers,
  endSwiss,
  findMatch,
  findPlayer,
  isReadOnly,
  isStarted,
  lastRound,
  matchContext,
  nextJoinRound,
  organizerRole,
  pairingPlayers,
  pairSwiss,
  pendingRound,
  readCut,
  rebuildCut,
  removePlayerBeforeStart,
  rewriteRoundMatches,
  roundIsUpToDate,
  sideOf,
  startedSwissRounds,
  winnerId,
} from "./service";
import { nextSlot } from "./top-cut";
import { createToken, hashToken } from "./tokens";

export const CLAIM_TTL_MS = 15 * 60_000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

export type CommandWarning = PairingWarning | { type: "draft_outdated" } | { type: "correction_after_pairing"; matchId: string };

export type CommandResult = {
  ok: true;
  warnings?: CommandWarning[];
  data?: Record<string, unknown>;
  /** Renvoi d'une commande déjà appliquée. */
  replayed?: boolean;
};

export type CommandOptions = { now?: Date; rng?: Rng };

type Ctx = { userId: string; role: "owner" | "co"; now: Date; rng: Rng };

/** Les secrets ne sont pas conservés dans le journal des commandes. */
const SECRET_KEYS = ["token"];

function redact(result: CommandResult): CommandResult {
  if (!result.data) return result;
  const data = Object.fromEntries(Object.entries(result.data).filter(([key]) => !SECRET_KEYS.includes(key)));
  return { ...result, data };
}

export async function runOrganizerCommand(
  tournamentId: string,
  userId: string,
  command: OrganizerCommand,
  options: CommandOptions = {},
): Promise<CommandResult> {
  const previous = await storedResult(tournamentId, command.clientActionId);
  if (previous) return previous;
  try {
    return await writeTournament(tournamentId, async (tx, t) => {
      // Revérifié sous verrou : une copie concurrente de la même commande a pu passer avant nous.
      const done = await tx.tournamentAction.findUnique({
        where: { tournamentId_clientActionId: { tournamentId, clientActionId: command.clientActionId } },
      });
      if (done) return { ...(JSON.parse(done.resultJson) as CommandResult), replayed: true };
      const role = organizerRole(t, userId);
      if (!role) fail("Réservé aux organisateurs du tournoi.", 403);
      const ctx: Ctx = { userId, role, now: options.now ?? new Date(), rng: options.rng ?? cryptoRng };
      const result = await dispatch(tx, t, command, ctx);
      await tx.tournamentAction.create({
        data: { tournamentId, clientActionId: command.clientActionId, resultJson: JSON.stringify(redact(result)) },
      });
      return result;
    });
  } catch (error) {
    // Même commande envoyée deux fois en parallèle : la seconde lit le résultat de la première.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const stored = await storedResult(tournamentId, command.clientActionId);
      if (stored) return stored;
    }
    throw error;
  }
}

async function storedResult(tournamentId: string, clientActionId: string): Promise<CommandResult | null> {
  const row = await prisma.tournamentAction.findUnique({
    where: { tournamentId_clientActionId: { tournamentId, clientActionId } },
  });
  if (!row) return null;
  return { ...(JSON.parse(row.resultJson) as CommandResult), replayed: true };
}

const OK: CommandResult = { ok: true };

async function dispatch(tx: Tx, t: FullTournament, command: OrganizerCommand, ctx: Ctx): Promise<CommandResult> {
  // Tournoi terminé ou annulé : lecture seule, sauf la correction de résultats.
  if (isReadOnly(t) && command.type !== "setResult") fail("Tournoi terminé : il est en lecture seule.", 409);

  switch (command.type) {
    case "updateSettings":
      return updateSettings(tx, t, command.settings);
    case "regenerateCode":
      return { ok: true, data: { code: await uniqueCode(tx, ctx.rng, t.id) } };
    case "setRegistration":
      await tx.tournament.update({ where: { id: t.id }, data: { registrationOpen: command.open } });
      return OK;
    case "addPlayer":
      return addPlayer(tx, t, command.name);
    case "renamePlayer":
      return renamePlayer(tx, t, command.playerId, command.name);
    case "removePlayer":
      await removePlayerBeforeStart(tx, t, findPlayer(t, command.playerId));
      return OK;
    case "approvePlayer":
      return approvePlayer(tx, t, command.playerId);
    case "rejectPlayer": {
      const player = findPlayer(t, command.playerId);
      if (player.status !== "pending") fail("Cette inscription n'est pas en attente.", 409);
      await tx.tournamentPlayer.delete({ where: { id: player.id } });
      return OK;
    }
    case "mergePlayers":
      return mergePlayers(tx, t, command.keepId, command.mergeId);
    case "issueClaim":
      return issueClaim(tx, t, command.playerId, ctx);
    case "dropPlayer":
      await dropPlayer(tx, t, findPlayer(t, command.playerId), { rng: ctx.rng, now: ctx.now });
      return OK;
    case "undropPlayer":
      return undropPlayer(tx, t, command.playerId);
    case "disqualify":
      await dropPlayer(tx, t, findPlayer(t, command.playerId), { rng: ctx.rng, now: ctx.now, dq: command.reason });
      return OK;
    case "pairRound":
      return pairRound(tx, t, ctx);
    case "swapPlayers":
      return editPairing(tx, t, (matches) => swapPlayers(matches, command.playerA, command.playerB));
    case "moveBye":
      return editPairing(tx, t, (matches) => moveBye(matches, command.playerId));
    case "publishRound": {
      const round = pendingRound(t) ?? fail("Aucune ronde à publier.", 409);
      if (round.status === "draft") await tx.tournamentRound.update({ where: { id: round.id }, data: { status: "published" } });
      return OK;
    }
    case "startRound":
      return startRound(tx, t, command, ctx);
    case "pauseClock":
      return updateClock(tx, t, (clock) => pauseClock(clock, ctx.now));
    case "resumeClock":
      return updateClock(tx, t, (clock) => resumeClock(clock, ctx.now));
    case "adjustClock":
      return updateClock(tx, t, (clock) => adjustClock(clock, command.seconds, ctx.now));
    case "addTableTime": {
      const { round, match } = findMatch(t, command.matchId);
      if (round.status !== "running") fail("La ronde n'est pas en cours.", 409);
      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: { extraSeconds: Math.max(0, match.extraSeconds + command.seconds), version: { increment: 1 } },
      });
      return OK;
    }
    case "setResult":
      return setResult(tx, t, command, ctx);
    case "resetResult": {
      const { round, match } = findMatch(t, command.matchId);
      if (round.status !== "running") fail("Seul un match de la ronde en cours peut être remis à zéro.", 409);
      await saveMatchState(tx, match, resetResult(toMatchState(match)), { action: "reset", actorUserId: ctx.userId });
      return OK;
    }
    case "noShow":
      return noShow(tx, t, command, ctx);
    case "closeRound":
      return closeRound(tx, t, ctx);
    case "declineCut":
      return declineCut(tx, t, command.playerId, ctx);
    case "inviteOrganizer":
      return inviteOrganizer(tx, t, ctx);
    case "removeOrganizer": {
      requireOwner(ctx);
      const target = t.organizers.find((organizer) => organizer.userId === command.userId);
      if (!target) fail("Organisateur introuvable.", 404);
      if (target.role === "owner") fail("L'organisateur principal ne peut pas être retiré.", 409);
      await tx.tournamentOrganizer.delete({ where: { tournamentId_userId: { tournamentId: t.id, userId: target.userId } } });
      return OK;
    }
    case "cancel":
      requireOwner(ctx);
      await tx.tournament.update({ where: { id: t.id }, data: { status: "annule" } });
      return OK;
  }
}

function requireOwner(ctx: Ctx) {
  if (ctx.role !== "owner") fail("Réservé à l'organisateur principal.", 403);
}

export async function uniqueCode(db: Tx | typeof prisma, rng: Rng, tournamentId?: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateTournamentCode(rng);
    const taken = await db.tournament.findUnique({ where: { code }, select: { id: true } });
    if (taken) continue;
    if (tournamentId) await db.tournament.update({ where: { id: tournamentId }, data: { code } });
    return code;
  }
  return fail("Impossible de générer un code, réessayez.", 503);
}

// --- Réglages --------------------------------------------------------------------------------

type Settings = Extract<OrganizerCommand, { type: "updateSettings" }>["settings"];

async function updateSettings(tx: Tx, t: FullTournament, settings: Settings): Promise<CommandResult> {
  const started = startedSwissRounds(t) > 0;
  if (started) {
    for (const key of ["format", "matchType", "lateEntryPolicy"] as const) {
      if (settings[key] !== undefined && settings[key] !== t[key]) {
        fail("Ce réglage est figé une fois le tournoi démarré.", 409);
      }
    }
  }
  if (settings.topCutSetting !== undefined && settings.topCutSetting !== t.topCutSetting && t.status !== "inscriptions" && t.status !== "suisse") {
    fail("Le top cut a déjà commencé.", 409);
  }
  const warnings: CommandWarning[] = [];
  if (settings.swissRounds !== undefined && settings.swissRounds !== t.swissRounds) {
    if (!started) fail("Le nombre de rondes est fixé au démarrage du tournoi.", 409);
    if (t.status !== "suisse") fail("Les rondes suisses sont terminées.", 409);
    const startedCount = startedSwissRounds(t);
    const lastPlanned = t.rounds.find((round) => round.phase === "swiss" && round.number === t.swissRounds);
    if (lastPlanned && isStarted(lastPlanned)) fail("La dernière ronde prévue a déjà démarré.", 409);
    if (settings.swissRounds < startedCount) fail(`${startedCount} rondes ont déjà démarré.`, 409);
    const draft = pendingRound(t);
    if (draft && draft.number > settings.swissRounds) await deleteDraftRound(tx, draft);
  }
  const { swissRounds, ...rest } = settings;
  await tx.tournament.update({
    where: { id: t.id },
    data: { ...rest, ...(swissRounds !== undefined ? { swissRounds } : {}) },
  });
  return { ok: true, warnings };
}

// --- Joueurs ---------------------------------------------------------------------------------

function assertNameFree(t: FullTournament, name: string, exceptId?: string) {
  const key = playerNameKey(name);
  if (t.players.some((player) => player.nameKey === key && player.id !== exceptId)) {
    fail("Pseudo déjà utilisé dans ce tournoi.", 409);
  }
  return key;
}

function assertRegistrationPhase(t: FullTournament) {
  if (t.status !== "inscriptions" && t.status !== "suisse") fail("Les rondes suisses sont terminées.", 409);
}

/** Avertit quand une ronde non démarrée ne correspond plus aux joueurs éligibles. */
function draftWarning(t: FullTournament): CommandWarning[] {
  return pendingRound(t) ? [{ type: "draft_outdated" }] : [];
}

async function addPlayer(tx: Tx, t: FullTournament, name: string): Promise<CommandResult> {
  assertRegistrationPhase(t);
  const nameKey = assertNameFree(t, name);
  const joinedRound = nextJoinRound(t);
  const player = await tx.tournamentPlayer.create({
    data: { tournamentId: t.id, name, nameKey, status: "active", joinedRound, missedRounds: joinedRound - 1 },
  });
  return { ok: true, data: { playerId: player.id }, warnings: draftWarning(t) };
}

async function renamePlayer(tx: Tx, t: FullTournament, playerId: string, name: string): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  const nameKey = assertNameFree(t, name, player.id);
  await tx.tournamentPlayer.update({ where: { id: player.id }, data: { name, nameKey } });
  return OK;
}

async function approvePlayer(tx: Tx, t: FullTournament, playerId: string): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  if (player.status !== "pending") fail("Cette inscription n'est pas en attente.", 409);
  assertRegistrationPhase(t);
  const joinedRound = nextJoinRound(t);
  await tx.tournamentPlayer.update({
    where: { id: player.id },
    data: { status: "active", joinedRound, missedRounds: joinedRound - 1 },
  });
  return { ok: true, warnings: draftWarning(t) };
}

async function undropPlayer(tx: Tx, t: FullTournament, playerId: string): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  if (player.status === "dq") fail("Une disqualification est définitive.", 409);
  if (player.status !== "dropped") fail("Ce joueur n'a pas droppé.", 409);
  if (t.status !== "suisse" && t.status !== "inscriptions") fail("Les rondes suisses sont terminées.", 409);
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

async function mergePlayers(tx: Tx, t: FullTournament, keepId: string, mergeId: string): Promise<CommandResult> {
  if (keepId === mergeId) fail("Choisissez deux joueurs différents.");
  const keep = findPlayer(t, keepId);
  const merge = findPlayer(t, mergeId);
  const roundsOf = (playerId: string) =>
    new Set(t.rounds.filter((round) => round.matches.some((match) => sideOf(match, playerId))).map((round) => round.number));
  for (const round of t.rounds) {
    for (const match of round.matches) {
      if (sideOf(match, keep.id) && sideOf(match, merge.id)) fail("Ces deux joueurs se sont affrontés : fusion impossible.", 409);
    }
  }
  const keepRounds = roundsOf(keep.id);
  for (const number of roundsOf(merge.id)) {
    if (keepRounds.has(number)) fail("Les deux profils ont un match dans la même ronde : droppez l'un des deux.", 409);
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

async function issueClaim(tx: Tx, t: FullTournament, playerId: string, ctx: Ctx): Promise<CommandResult> {
  const player = findPlayer(t, playerId);
  const token = createToken();
  const expiresAt = new Date(ctx.now.getTime() + CLAIM_TTL_MS);
  await tx.tournamentPlayer.update({
    where: { id: player.id },
    data: { claimTokenHash: hashToken(token), claimExpiresAt: expiresAt },
  });
  return { ok: true, data: { token, expiresAt: expiresAt.toISOString() } };
}

// --- Rondes ----------------------------------------------------------------------------------

async function pairRound(tx: Tx, t: FullTournament, ctx: Ctx): Promise<CommandResult> {
  if (t.status === "top_cut") {
    // Top cut : recompose le premier tour tant qu'il n'a pas démarré (les tours suivants sont automatiques).
    if (!cutStillOpen(t)) fail("Les tours suivants du top cut sont appariés automatiquement.", 409);
    await rebuildCut(tx, t, ctx.rng, ctx.now);
    return OK;
  }
  const last = lastRound(t);
  if (last?.status === "running") fail("La ronde en cours n'est pas clôturée.", 409);
  let number = (last?.number ?? 0) + 1;
  if (last && !isStarted(last)) {
    // Relancer l'appariement : la ronde non démarrée est remplacée.
    await deleteDraftRound(tx, last);
    number = last.number;
  }
  if (number > t.swissRounds) fail("Toutes les rondes suisses prévues ont été jouées.", 409);
  const view: FullTournament = last && !isStarted(last) ? { ...t, rounds: t.rounds.slice(0, -1) } : t;
  const { roundId, warnings } = await pairSwiss(tx, view, number, ctx.rng);
  return { ok: true, data: { roundId }, warnings };
}

async function editPairing(tx: Tx, t: FullTournament, edit: (matches: PairedMatch[]) => PairedMatch[]): Promise<CommandResult> {
  const round = pendingRound(t) ?? fail("La ronde a démarré : appariements figés.", 409);
  if (round.phase !== "swiss") fail("L'arbre du top cut suit le classement : il ne se modifie pas à la main.", 409);
  const current = round.matches.map((match) => ({ a: match.playerAId, b: match.playerBId }));
  const next = edit(current);
  await rewriteRoundMatches(tx, t, round, next);
  const ids = new Set(next.flatMap((match) => (match.b ? [match.a, match.b] : [match.a])));
  const before: FullTournament = { ...t, rounds: t.rounds.filter((candidate) => candidate.id !== round.id) };
  return { ok: true, warnings: round.number > 1 ? pairingWarnings(next, pairingPlayers(before, ids)) : [] };
}

async function startRound(
  tx: Tx,
  t: FullTournament,
  command: Extract<OrganizerCommand, { type: "startRound" }>,
  ctx: Ctx,
): Promise<CommandResult> {
  const round = pendingRound(t) ?? fail("Aucune ronde à démarrer : appariez d'abord la ronde.", 409);
  if (round.phase === "swiss" && round.number === 1) {
    const pending = t.players.filter((player) => player.status === "pending").length;
    if (pending > 0 && !command.ignorePending) {
      fail(`${pending} inscription(s) en attente d'approbation.`, 409, { needs: "pending", pending });
    }
    const active = eligiblePlayers(t, 1).length;
    if (active < 2) fail("Il faut au moins 2 joueurs actifs.", 409);
    if (active < 4 && !command.confirmFewPlayers) {
      fail("Moins de 4 joueurs : confirmez le démarrage.", 409, { needs: "fewPlayers", active });
    }
  }
  if (!roundIsUpToDate(t, round)) fail("Les inscriptions ont changé depuis l'appariement : relancez l'appariement.", 409);
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

async function updateClock(tx: Tx, t: FullTournament, change: (clock: RoundClock) => RoundClock): Promise<CommandResult> {
  const round = lastRound(t);
  if (!round || round.status !== "running") fail("Aucune ronde en cours.", 409);
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

async function closeRound(tx: Tx, t: FullTournament, ctx: Ctx): Promise<CommandResult> {
  const round = lastRound(t);
  if (!round || round.status !== "running") fail("Aucune ronde en cours.", 409);
  const open = round.matches.filter((match) => match.status !== "valide");
  if (open.length > 0) {
    fail(`${open.length} match(s) sans résultat validé.`, 409, { matchIds: open.map((match) => match.id) });
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

async function declineCut(tx: Tx, t: FullTournament, playerId: string, ctx: Ctx): Promise<CommandResult> {
  if (!cutStillOpen(t)) fail("Le top cut a déjà commencé.", 409);
  const cut = readCut(t);
  if (!cut?.seeds.includes(playerId)) fail("Ce joueur n'est pas qualifié pour le top cut.", 409);
  await tx.tournamentPlayer.update({ where: { id: playerId }, data: { cutDeclined: true } });
  await rebuildCut(tx, t, ctx.rng, ctx.now);
  return OK;
}

// --- Résultats -------------------------------------------------------------------------------

async function setResult(
  tx: Tx,
  t: FullTournament,
  command: Extract<OrganizerCommand, { type: "setResult" }>,
  ctx: Ctx,
): Promise<CommandResult> {
  const { round, match } = findMatch(t, command.matchId);
  if (!isStarted(round)) fail("La ronde n'a pas démarré.", 409);
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
    fail("Ce match a été validé entre-temps avec un autre score.", 409, { current, proposed: command.result });
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
  if (isStarted(following)) fail("Le tour suivant a démarré : correction impossible.", 409);
  if (match.bracketSlot === null || !newWinner) return;
  const target = nextSlot(match.bracketSlot);
  const nextMatch = following.matches.find((candidate) => candidate.bracketSlot === target.slot);
  if (!nextMatch) return;
  await tx.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: target.side === "A" ? { playerAId: newWinner } : { playerBId: newWinner },
  });
}

async function noShow(
  tx: Tx,
  t: FullTournament,
  command: Extract<OrganizerCommand, { type: "noShow" }>,
  ctx: Ctx,
): Promise<CommandResult> {
  const { round, match } = findMatch(t, command.matchId);
  if (round.status !== "running") fail("La ronde n'est pas en cours.", 409);
  const side = sideOf(match, command.absentPlayerId) ?? fail("Ce joueur ne joue pas ce match.", 400);
  const next = noShowResult(toMatchState(match), side, matchContext(t, round, ctx.now));
  await saveMatchState(tx, match, next, { action: "no_show", actorUserId: ctx.userId });
  if (command.drop) await dropPlayer(tx, t, findPlayer(t, command.absentPlayerId), { rng: ctx.rng, now: ctx.now });
  return OK;
}

// --- Organisateurs ---------------------------------------------------------------------------

async function inviteOrganizer(tx: Tx, t: FullTournament, ctx: Ctx): Promise<CommandResult> {
  requireOwner(ctx);
  const token = createToken();
  const expiresAt = new Date(ctx.now.getTime() + INVITE_TTL_MS);
  await tx.tournamentInvite.create({ data: { tournamentId: t.id, tokenHash: hashToken(token), expiresAt } });
  return { ok: true, data: { token, expiresAt: expiresAt.toISOString() } };
}

/** Accepte une invitation de co-organisateur (usage unique). */
export async function acceptOrganizerInvite(token: string, userId: string, now = new Date()) {
  const invite = await prisma.tournamentInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.usedAt || invite.expiresAt <= now) fail("Invitation invalide ou expirée.", 404);
  return writeTournament(invite.tournamentId, async (tx, t) => {
    const { count } = await tx.tournamentInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: now } });
    if (count === 0) fail("Invitation invalide ou expirée.", 404);
    if (!organizerRole(t, userId)) {
      await tx.tournamentOrganizer.create({ data: { tournamentId: t.id, userId, role: "co" } });
    }
    return { tournamentId: t.id };
  });
}

// --- Création, suppression, liste ------------------------------------------------------------

export type TournamentCreateInput = Omit<Settings, "swissRounds"> & { name: string };

export async function createTournament(userId: string, input: TournamentCreateInput, rng: Rng = cryptoRng) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await uniqueCode(prisma, rng);
    try {
      return await prisma.tournament.create({
        data: { ...input, code, organizers: { create: { userId, role: "owner" } } },
        select: { id: true, code: true },
      });
    } catch (error) {
      // Code pris entre la vérification et l'insertion : on en tire un autre.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return fail("Impossible de générer un code, réessayez.", 503);
}

/** Suppression définitive, réservée à l'organisateur principal. */
export async function deleteTournament(tournamentId: string, userId: string) {
  await writeTournament(tournamentId, async (tx, t) => {
    const role = organizerRole(t, userId);
    if (!role) fail("Réservé aux organisateurs du tournoi.", 403);
    if (role !== "owner") fail("Réservé à l'organisateur principal.", 403);
    if (t.rounds.some(isStarted)) fail("Un tournoi commencé ne peut plus être supprimé : annulez-le.", 409);
    if (t.players.length) fail("Un tournoi avec des inscrits ne peut pas être supprimé : annulez-le.", 409);
    await tx.tournament.delete({ where: { id: t.id } });
  });
}

/** Tournois organisés et joués par un compte, du plus récent au plus ancien. */
export async function listTournaments(userId: string) {
  const rows = await prisma.tournament.findMany({
    where: { OR: [{ organizers: { some: { userId } } }, { players: { some: { userId } } }] },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      format: true,
      createdAt: true,
      organizers: { where: { userId }, select: { role: true } },
      _count: { select: { players: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    format: row.format,
    createdAt: row.createdAt.toISOString(),
    role: (row.organizers[0]?.role ?? null) as "owner" | "co" | null,
    playerCount: row._count.players,
  }));
}

export { TournamentError };
