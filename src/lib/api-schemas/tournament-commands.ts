import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { id, intIn } from "./common";
import { matchResultSchema, playerNameSchema, tournamentListingFields, tournamentSettingsFields } from "./tournaments";

const clientActionId = z.string({ error: m("common.invalidRequest") }).trim().min(8).max(64);
const entityId = id;

/** Commandes organisateur (POST /api/tournaments/[id]/actions), rejouables par la file hors connexion. */
export const organizerCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("updateSettings"),
    clientActionId,
    settings: z.object({
      ...tournamentSettingsFields,
      ...tournamentListingFields,
      swissRounds: intIn(1, 20, m("tournaments.invalidSwissRounds", { min: 1, max: 20 })).optional(),
    }),
  }),
  z.object({ type: z.literal("setVisibility"), clientActionId, public: z.boolean() }),
  z.object({ type: z.literal("setShop"), clientActionId, shopId: entityId.nullable() }),
  z.object({ type: z.literal("promoteWaitlisted"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("regenerateCode"), clientActionId }),
  z.object({ type: z.literal("setRegistration"), clientActionId, open: z.boolean() }),
  z.object({ type: z.literal("addPlayer"), clientActionId, name: playerNameSchema }),
  z.object({ type: z.literal("renamePlayer"), clientActionId, playerId: entityId, name: playerNameSchema }),
  z.object({ type: z.literal("removePlayer"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("approvePlayer"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("rejectPlayer"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("mergePlayers"), clientActionId, keepId: entityId, mergeId: entityId }),
  z.object({ type: z.literal("issueClaim"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("dropPlayer"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("undropPlayer"), clientActionId, playerId: entityId }),
  z.object({
    type: z.literal("disqualify"),
    clientActionId,
    playerId: entityId,
    reason: z.string({ error: m("tournaments.invalidReason") }).trim().min(1, m("tournaments.reasonRequired")).max(200, m("tournaments.reasonTooLong")),
  }),
  z.object({ type: z.literal("pairRound"), clientActionId }),
  z.object({ type: z.literal("swapPlayers"), clientActionId, playerA: entityId, playerB: entityId }),
  z.object({ type: z.literal("moveBye"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("publishRound"), clientActionId }),
  z.object({
    type: z.literal("startRound"),
    clientActionId,
    confirmFewPlayers: z.boolean().optional(),
    ignorePending: z.boolean().optional(),
  }),
  z.object({ type: z.literal("pauseClock"), clientActionId }),
  z.object({ type: z.literal("resumeClock"), clientActionId }),
  z.object({ type: z.literal("adjustClock"), clientActionId, seconds: intIn(-7200, 7200, m("tournaments.invalidDuration")) }),
  z.object({ type: z.literal("addTableTime"), clientActionId, matchId: entityId, seconds: intIn(-3600, 3600, m("tournaments.invalidDuration")) }),
  z.object({
    type: z.literal("setResult"),
    clientActionId,
    matchId: entityId,
    result: matchResultSchema,
    expectedVersion: z.number().int().min(0).optional(),
  }),
  z.object({ type: z.literal("resetResult"), clientActionId, matchId: entityId }),
  z.object({ type: z.literal("noShow"), clientActionId, matchId: entityId, absentPlayerId: entityId, drop: z.boolean().optional() }),
  z.object({ type: z.literal("closeRound"), clientActionId }),
  z.object({ type: z.literal("declineCut"), clientActionId, playerId: entityId }),
  z.object({ type: z.literal("inviteOrganizer"), clientActionId }),
  z.object({ type: z.literal("removeOrganizer"), clientActionId, userId: entityId }),
  z.object({ type: z.literal("cancel"), clientActionId }),
]);

export type OrganizerCommand = z.output<typeof organizerCommandSchema>;

/** Commandes joueur (POST /api/tournaments/[id]/player). */
export const playerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("declare"), matchId: entityId, result: matchResultSchema }),
  z.object({ type: z.literal("confirm"), matchId: entityId }),
  z.object({ type: z.literal("refuse"), matchId: entityId }),
  z.object({ type: z.literal("confirmOnSite"), matchId: entityId }),
  z.object({ type: z.literal("drop") }),
  z.object({ type: z.literal("withdraw") }),
]);

export type PlayerCommand = z.output<typeof playerCommandSchema>;
