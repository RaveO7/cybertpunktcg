// Places et liste d'attente (cf. specs/tournaments/capacity). Les joueurs actifs et en attente
// d'approbation occupent une place ; au-delà de `maxPlayers`, une inscription passe en
// `waitlist`, dans l'ordre d'inscription (createdAt). Dès qu'une place se libère et qu'une
// inscription est encore possible, les premiers en attente sont promus.

import type { FullTournament, PlayerRow, Tx } from "./repository";
import { nextJoinRound } from "./service";

type CapacityPlayer = Pick<PlayerRow, "id" | "status" | "createdAt">;

export function occupiesSeat(player: Pick<PlayerRow, "status">) {
  return player.status === "active" || player.status === "pending";
}

export function seatsTaken(players: readonly Pick<PlayerRow, "status">[]) {
  return players.filter(occupiesSeat).length;
}

export function isFull(maxPlayers: number | null, players: readonly Pick<PlayerRow, "status">[]) {
  return maxPlayers !== null && seatsTaken(players) >= maxPlayers;
}

/** Liste d'attente dans l'ordre (position 1 = premier promu). */
export function waitlist<P extends CapacityPlayer>(players: readonly P[]): P[] {
  return players
    .filter((player) => player.status === "waitlist")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}

export function waitlistPosition(players: readonly CapacityPlayer[], playerId: string) {
  const index = waitlist(players).findIndex((player) => player.id === playerId);
  return index === -1 ? null : index + 1;
}

/** Une inscription est encore possible (mêmes conditions que l'inscription par code). */
export function registrationPossible(t: Pick<FullTournament, "status" | "registrationOpen">) {
  return (t.status === "inscriptions" || t.status === "suisse") && t.registrationOpen;
}

/** Joueurs à promouvoir : autant que de places libres, dans l'ordre de la liste. */
export function playersToPromote<P extends CapacityPlayer>(maxPlayers: number | null, players: readonly P[]): P[] {
  const queue = waitlist(players);
  if (maxPlayers === null) return queue;
  return queue.slice(0, Math.max(0, maxPlayers - seatsTaken(players)));
}

/**
 * Promotion automatique. Relit joueurs et réglages dans la transaction : la commande qui a
 * libéré la place (ou changé `maxPlayers`, rouvert les inscriptions) vient d'y écrire.
 * Renvoie les ids promus.
 */
export async function promoteWaitlist(tx: Tx, t: FullTournament): Promise<string[]> {
  const fresh = await tx.tournament.findUnique({
    where: { id: t.id },
    select: { status: true, registrationOpen: true, maxPlayers: true, requireApproval: true },
  });
  if (!fresh || !registrationPossible(fresh)) return [];
  const players = await tx.tournamentPlayer.findMany({
    where: { tournamentId: t.id },
    select: { id: true, status: true, createdAt: true },
  });
  const promoted = playersToPromote(fresh.maxPlayers, players);
  if (!promoted.length) return [];
  const joinedRound = nextJoinRound(t);
  await tx.tournamentPlayer.updateMany({
    where: { id: { in: promoted.map((player) => player.id) }, status: "waitlist" },
    data: { status: fresh.requireApproval ? "pending" : "active", joinedRound, missedRounds: joinedRound - 1 },
  });
  return promoted.map((player) => player.id);
}
