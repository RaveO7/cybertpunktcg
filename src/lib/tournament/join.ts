// Inscription par code ou QR du tournoi : avec un compte ou en invité (pseudo seul).

import { isFull, promoteWaitlist, waitlist } from "./capacity";
import { playerNameKey } from "./code";
import { fail } from "./errors";
import { findViewerPlayer, newDeviceToken, type Viewer } from "./player-auth";
import { writeTournament } from "./repository";
import { hasApp, nextJoinRound } from "./service";

/** Nom par défaut d'un compte (« Ma collection ») : pas un pseudo de joueur. */
const DEFAULT_DISPLAY_NAME = "Ma collection";

export type JoinResult = {
  playerId: string;
  /** Déjà inscrit : on retrouve le joueur au lieu d'en créer un second. */
  existing: boolean;
  status: string;
  /** Jeton d'appareil à poser en cookie (nouvelle inscription seulement). */
  deviceToken: string | null;
};

export async function joinTournament(
  tournamentId: string,
  viewer: Viewer & { displayName?: string | null },
  name: string | undefined,
): Promise<JoinResult> {
  return writeTournament(tournamentId, async (tx, t) => {
    const already = findViewerPlayer(t, viewer);
    if (already) return { playerId: already.id, existing: true, status: already.status, deviceToken: null };

    if (t.status !== "inscriptions" && t.status !== "suisse") fail("tournaments.registrationsOver", 409);
    if (!t.registrationOpen) fail("tournaments.registrationsClosed", 403);

    const accountName = viewer.userId && viewer.displayName !== DEFAULT_DISPLAY_NAME ? viewer.displayName : null;
    const playerName = name ?? accountName ?? fail("tournaments.pseudoRequired", 400);
    const nameKey = playerNameKey(playerName);
    const clash = t.players.find((player) => player.nameKey === nameKey);
    if (clash) {
      if (!hasApp(clash)) {
        fail("tournaments.nameClash", 409, { reason: "paper_player", name: clash.name }, { name: clash.name });
      }
      fail("tournaments.pseudoTaken", 409, { reason: "name_taken" });
    }

    const joinedRound = nextJoinRound(t);
    const device = newDeviceToken();
    // Complet, ou d'autres attendent déjà : on prend son tour dans la liste d'attente, puis
    // la promotion décide (dans l'ordre) qui obtient les places libres.
    const queued = isFull(t.maxPlayers, t.players) || waitlist(t.players).length > 0;
    const player = await tx.tournamentPlayer.create({
      data: {
        tournamentId: t.id,
        userId: viewer.userId,
        name: playerName,
        nameKey,
        status: queued ? "waitlist" : t.requireApproval ? "pending" : "active",
        joinedRound,
        missedRounds: joinedRound - 1,
        deviceTokenHash: device.hash,
      },
    });
    let status = player.status;
    if (queued && (await promoteWaitlist(tx, t)).includes(player.id)) {
      status = t.requireApproval ? "pending" : "active";
    }
    return { playerId: player.id, existing: false, status, deviceToken: device.token };
  });
}
