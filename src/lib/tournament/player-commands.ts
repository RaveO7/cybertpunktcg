// Commandes d'un joueur depuis son appareil : déclarer, confirmer, refuser, confirmer sur place
// (adversaire sans l'app), drop, désinscription avant le tournoi. Seuls les deux joueurs d'un
// match peuvent toucher à son résultat.

import type { PlayerCommand } from "@/lib/api-schemas";
import { fail } from "./errors";
import { confirmOnSite, confirmResult, declareResult, refuseResult } from "./match-state";
import { findViewerPlayer, type Viewer } from "./player-auth";
import { cryptoRng, type Rng } from "./random";
import { saveMatchState, toMatchState, writeTournament } from "./repository";
import { dropPlayer, findMatch, isReadOnly, isStarted, matchContext, removePlayerBeforeStart, sideOf } from "./service";

export async function runPlayerCommand(
  tournamentId: string,
  viewer: Viewer,
  command: PlayerCommand,
  options: { now?: Date; rng?: Rng } = {},
) {
  const now = options.now ?? new Date();
  return writeTournament(tournamentId, async (tx, t) => {
    const player = findViewerPlayer(t, viewer) ?? fail("Vous n'êtes pas inscrit à ce tournoi.", 403);
    if (isReadOnly(t)) fail("Tournoi terminé.", 409);

    if (command.type === "drop") {
      await dropPlayer(tx, t, player, { rng: options.rng ?? cryptoRng, now });
      return { ok: true as const };
    }
    if (command.type === "withdraw") {
      await removePlayerBeforeStart(tx, t, player);
      return { ok: true as const };
    }

    const { round, match } = findMatch(t, command.matchId);
    const side = sideOf(match, player.id) ?? fail("Ce match n'est pas le vôtre.", 403);
    if (round.status !== "running") {
      fail(isStarted(round) ? "La ronde est clôturée : adressez-vous à l'organisateur." : "La ronde n'a pas démarré.", 409);
    }
    const state = toMatchState(match);
    const ctx = matchContext(t, round, now);
    const next =
      command.type === "declare"
        ? declareResult(state, side, command.result, ctx)
        : command.type === "confirm"
          ? confirmResult(state, side)
          : command.type === "refuse"
            ? refuseResult(state, side)
            : confirmOnSite(state, side, ctx);
    await saveMatchState(tx, match, next, { action: command.type, actorUserId: viewer.userId, actorPlayerId: player.id });
    return { ok: true as const, status: next.status };
  });
}
