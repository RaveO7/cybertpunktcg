// Commandes organisateur (TO et co-organisateurs). Point d'entrée unique et idempotent :
// une commande déjà appliquée (même clientActionId) renvoie le résultat enregistré, ce qui
// permet à la file hors connexion de renvoyer sans risque de double effet.

import { Prisma } from "@prisma/client";
import type { OrganizerCommand, TournamentCreateInput } from "@/lib/api-schemas";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { promoteWaitlist } from "./capacity";
import { adjustClock, pauseClock, resumeClock } from "./clock";
import { OK, draftWarning, requireOwner, type CommandResult, type Ctx } from "./command-context";
import { generateTournamentCode } from "./code";
import { fail, TournamentError } from "./errors";
import { resetResult } from "./match-state";
import { moveBye, swapPlayers, type TournamentFormat } from "./pairing";
import { NOTIFYING_COMMANDS, tournamentEvents, type TournamentEvent } from "./notifications";
import { cryptoRng, type Rng } from "./random";
import { loadTournament, saveMatchState, toMatchState, writeTournament, type FullTournament, type Tx } from "./repository";
import { editPairing, closeRound, declineCut, pairRound, startRound, updateClock } from "./round-commands";
import { addPlayer, approvePlayer, assertRegistrationPhase, issueClaim, mergePlayers, renamePlayer, undropPlayer } from "./roster-commands";
import { noShow, setResult } from "./result-commands";
import { setShop, setVisibility, updateSettings } from "./settings-commands";
import { dropPlayer, findMatch, findPlayer, isReadOnly, nextJoinRound, organizerRole, pendingRound, removePlayerBeforeStart, isStarted, type TournamentStatus } from "./service";
import { readCommandResult } from "./stored-json";
import { createToken, hashToken } from "./tokens";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;


export type CommandOptions = {
  now?: Date;
  rng?: Rng;
  /** Évènements à notifier aux joueurs, appelé une fois la commande validée (pas pour un renvoi). */
  onEvents?: (events: TournamentEvent[]) => void;
};



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
  if (command.type === "setVisibility" && command.public) {
    // Garde-fou contre le spam de l'annuaire : 10 publications par jour et par compte.
    const limited = await rateLimit(`tournament-publish:${userId}`, 10, 24 * 60 * 60_000);
    if (!limited.ok) fail("tournaments.tooManyPublications", 429);
  }
  try {
    const { result, events } = await writeTournament(tournamentId, async (tx, t) => {
      // Revérifié sous verrou : une copie concurrente de la même commande a pu passer avant nous.
      const done = await tx.tournamentAction.findUnique({
        where: { tournamentId_clientActionId: { tournamentId, clientActionId: command.clientActionId } },
      });
      if (done) return { result: readCommandResult(done.resultJson), events: [] };
      const role = organizerRole(t, userId);
      if (!role) fail("tournaments.organizersOnly", 403);
      const ctx: Ctx = { userId, role, now: options.now ?? new Date(), rng: options.rng ?? cryptoRng };
      const result = await dispatch(tx, t, command, ctx);
      await tx.tournamentAction.create({
        data: { tournamentId, clientActionId: command.clientActionId, resultJson: JSON.stringify(redact(result)) },
      });
      const after = NOTIFYING_COMMANDS.has(command.type) ? await loadTournament(tx, tournamentId) : null;
      return { result, events: after ? tournamentEvents(t, after, userId) : [] };
    });
    if (events.length) options.onEvents?.(events);
    return result;
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
  return readCommandResult(row.resultJson);
}

/** Commandes qui peuvent libérer une place (ou en créer) : la liste d'attente avance ensuite. */
const MAY_FREE_SEAT: ReadonlySet<OrganizerCommand["type"]> = new Set([
  "updateSettings",
  "setRegistration",
  "removePlayer",
  "rejectPlayer",
  "mergePlayers",
  "dropPlayer",
  "disqualify",
  "noShow",
]);

async function dispatch(tx: Tx, t: FullTournament, command: OrganizerCommand, ctx: Ctx): Promise<CommandResult> {
  const result = await dispatchCommand(tx, t, command, ctx);
  if (!MAY_FREE_SEAT.has(command.type)) return result;
  const promoted = await promoteWaitlist(tx, t);
  return promoted.length ? { ...result, data: { ...result.data, promoted } } : result;
}

async function dispatchCommand(tx: Tx, t: FullTournament, command: OrganizerCommand, ctx: Ctx): Promise<CommandResult> {
  // Tournoi terminé ou annulé : lecture seule, sauf la correction de résultats.
  if (isReadOnly(t) && command.type !== "setResult") fail("tournaments.readOnly", 409);

  switch (command.type) {
    case "updateSettings":
      return updateSettings(tx, t, command.settings);
    case "setVisibility":
      return setVisibility(tx, t, command.public, ctx);
    case "setShop":
      return setShop(tx, t, command.shopId, ctx);
    case "promoteWaitlisted": {
      const player = findPlayer(t, command.playerId);
      if (player.status !== "waitlist") fail("tournaments.notWaitlisted", 409);
      assertRegistrationPhase(t);
      // Choix explicite du TO : il vaut approbation, même au-delà du nombre de places.
      const joinedRound = nextJoinRound(t);
      await tx.tournamentPlayer.update({
        where: { id: player.id },
        data: { status: "active", joinedRound, missedRounds: joinedRound - 1 },
      });
      return { ok: true, warnings: draftWarning(t) };
    }
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
      if (player.status !== "pending") fail("tournaments.notPending", 409);
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
      const round = pendingRound(t) ?? fail("tournaments.noRoundToPublish", 409);
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
      if (round.status !== "running") fail("tournaments.roundNotRunning", 409);
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
      if (round.status !== "running") fail("tournaments.resetOnlyCurrentRound", 409);
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
      if (!target) fail("tournaments.organizerNotFound", 404);
      if (target.role === "owner") fail("tournaments.ownerCannotBeRemoved", 409);
      await tx.tournamentOrganizer.delete({ where: { tournamentId_userId: { tournamentId: t.id, userId: target.userId } } });
      return OK;
    }
    case "cancel":
      requireOwner(ctx);
      await tx.tournament.update({ where: { id: t.id }, data: { status: "annule" } });
      return OK;
  }
}


export async function uniqueCode(db: Tx | typeof prisma, rng: Rng, tournamentId?: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateTournamentCode(rng);
    const taken = await db.tournament.findUnique({ where: { code }, select: { id: true } });
    if (taken) continue;
    if (tournamentId) await db.tournament.update({ where: { id: tournamentId }, data: { code } });
    return code;
  }
  return fail("tournaments.codeGenerationFailed", 503);
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
/** Invitation encore utilisable, sans la consommer : la page l'affiche avant le geste explicite. */
export async function organizerInviteUsable(token: string, now = new Date()) {
  const invite = await prisma.tournamentInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return Boolean(invite && !invite.usedAt && invite.expiresAt > now);
}

export async function acceptOrganizerInvite(token: string, userId: string, now = new Date()) {
  const invite = await prisma.tournamentInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.usedAt || invite.expiresAt <= now) fail("tournaments.invalidInvite", 404);
  return writeTournament(invite.tournamentId, async (tx, t) => {
    const { count } = await tx.tournamentInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: now } });
    if (count === 0) fail("tournaments.invalidInvite", 404);
    if (!organizerRole(t, userId)) {
      await tx.tournamentOrganizer.create({ data: { tournamentId: t.id, userId, role: "co" } });
    }
    return { tournamentId: t.id };
  });
}

// --- Création, suppression, liste ------------------------------------------------------------

export type { TournamentCreateInput };

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
  return fail("tournaments.codeGenerationFailed", 503);
}

/** Suppression définitive, réservée à l'organisateur principal. */
export async function deleteTournament(tournamentId: string, userId: string) {
  await writeTournament(tournamentId, async (tx, t) => {
    const role = organizerRole(t, userId);
    if (!role) fail("tournaments.organizersOnly", 403);
    if (role !== "owner") fail("tournaments.ownerOnly", 403);
    if (t.rounds.some(isStarted)) fail("tournaments.startedCannotDelete", 409);
    if (t.players.length) fail("tournaments.registeredCannotDelete", 409);
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
    status: row.status as TournamentStatus,
    format: row.format as TournamentFormat,
    createdAt: row.createdAt.toISOString(),
    role: (row.organizers[0]?.role ?? null) as "owner" | "co" | null,
    playerCount: row._count.players,
  }));
}

export { TournamentError };
