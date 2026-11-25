// Types et aides partagés par les commandes organisateur (voir commands.ts).

import type { Rng } from "./random";
import { fail } from "./errors";
import { pendingRound } from "./service";
import type { FullTournament } from "./repository";
import type { PairingWarning } from "./pairing";

export type CommandWarning = PairingWarning | { type: "draft_outdated" } | { type: "correction_after_pairing"; matchId: string };

export type CommandResult = {
  ok: true;
  warnings?: CommandWarning[];
  data?: Record<string, unknown>;
  /** Renvoi d'une commande déjà appliquée. */
  replayed?: boolean;
};

export type Ctx = { userId: string; role: "owner" | "co"; now: Date; rng: Rng };

export const OK: CommandResult = { ok: true };

export function requireOwner(ctx: Ctx) {
  if (ctx.role !== "owner") fail("tournaments.ownerOnly", 403);
}

/** Avertit quand une ronde non démarrée ne correspond plus aux joueurs éligibles. */
export function draftWarning(t: FullTournament): CommandWarning[] {
  return pendingRound(t) ? [{ type: "draft_outdated" }] : [];
}
