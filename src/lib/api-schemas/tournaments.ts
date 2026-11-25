import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { normalizePlayerName } from "../tournament/code";
import { DESCRIPTION_MAX, PRIZES_MAX, TOURNAMENT_CURRENCIES } from "../tournament/listing";
import type { MatchResult } from "../tournament/scores";
import { TOP_CUT_SETTINGS } from "../tournament/top-cut";
import { intIn, normalized, optionalText } from "./common";
import { placeSchema } from "./geo";
import { shareTokenSchema } from "./share";

const tournamentNameSchema = z
  .string({ error: m("tournaments.invalidName") })
  .trim()
  .min(1, m("tournaments.nameRequired"))
  .max(60, m("tournaments.nameTooLong", { max: 60 }));

export const playerNameSchema = normalized(normalizePlayerName, m("tournaments.pseudoLength", { min: 1, max: 32 }));

export const tournamentSettingsFields = {
  name: tournamentNameSchema.optional(),
  format: z.enum(["boutique", "competitif"], { error: m("tournaments.invalidFormat") }).optional(),
  matchType: z.enum(["bo1", "bo3"], { error: m("tournaments.invalidMatchType") }).optional(),
  roundMinutes: intIn(10, 180, m("tournaments.invalidRoundMinutes", { min: 10, max: 180 })).optional(),
  topCutExtraMinutes: intIn(0, 120, m("tournaments.invalidTopCutExtra", { min: 0, max: 120 })).optional(),
  topCutSetting: z.enum(TOP_CUT_SETTINGS, { error: m("tournaments.invalidTopCut") }).optional(),
  requireApproval: z.boolean().optional(),
  oneDeviceMode: z.enum(["direct", "organizer"], { error: m("tournaments.invalidValidationMode") }).optional(),
  declareTimeoutMinutes: intIn(1, 120, m("tournaments.invalidDeclareTimeout", { min: 1, max: 120 })).optional(),
  lateEntryPolicy: z.enum(["zero", "loss"], { error: m("tournaments.invalidLateEntry") }).optional(),
};

export const tournamentCreateSchema = z.object({ ...tournamentSettingsFields, name: tournamentNameSchema });
export type TournamentCreateInput = z.output<typeof tournamentCreateSchema>;

export const matchResultSchema = z
  .object({
    kind: z.enum(["normal", "id", "double_loss"], { error: m("tournaments.invalidResult") }).default("normal"),
    gamesA: intIn(0, 2, m("tournaments.invalidScore")),
    gamesB: intIn(0, 2, m("tournaments.invalidScore")),
  })
  .transform((result): MatchResult => result);

/** Informations de présentation d'un tournoi (publics ou non), cf. specs/tournaments/public-listing. */
export const tournamentListingFields = {
  startsAt: z.iso
    .datetime({ offset: true, error: m("tournaments.invalidStartDate") })
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
  timeZone: z
    .string({ error: m("tournaments.invalidTimeZone") })
    .max(64)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, m("tournaments.invalidTimeZone"))
    .nullable()
    .optional(),
  place: placeSchema.nullable().optional(),
  entryFeeCents: intIn(1, 100_000_00, m("tournaments.invalidEntryFee")).nullable().optional(),
  currency: z.enum(TOURNAMENT_CURRENCIES, { error: m("common.invalidCurrency") }).optional(),
  maxPlayers: intIn(2, 512, m("tournaments.invalidMaxPlayers", { min: 2, max: 512 })).nullable().optional(),
  description: optionalText(DESCRIPTION_MAX, m("tournaments.descriptionTooLong", { max: DESCRIPTION_MAX })),
  prizes: optionalText(PRIZES_MAX, m("tournaments.prizesTooLong", { max: PRIZES_MAX })),
};

/** Inscription par code : pseudo obligatoire pour un invité, facultatif avec un compte. */
export const tournamentJoinSchema = z.object({ name: playerNameSchema.optional() });

export const tournamentTokenSchema = z.object({ token: shareTokenSchema });
