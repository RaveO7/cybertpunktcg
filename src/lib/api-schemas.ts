// Schémas Zod des entrées des routes API. Toute nouvelle route qui lit un corps JSON
// doit passer par readJsonBody(request, schéma) : pas de parsing manuel.
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDisplayName, normalizeEmail, normalizeLoginPassword, normalizePassword } from "./auth";
import { MAX_IMPORT_LINES } from "./collection-csv";
import { CURRENCIES } from "./parse";
import { normalizePlayerName } from "./tournament/code";
import type { MatchResult } from "./tournament/scores";
import { TOP_CUT_SETTINGS } from "./tournament/top-cut";

const INVALID_REQUEST = "Requête invalide.";

/** Applique une fonction de normalisation existante (null = invalide) avec un message dédié. */
function normalized<T>(normalize: (value: unknown) => T | null, message: string) {
  return z.string({ error: message }).transform((value, ctx) => {
    const result = normalize(value);
    if (result === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return result;
  });
}

const id = z.string().trim().min(1).max(128);
const conditionCode = z.string().trim().min(1).max(16);

// Accepte un nombre ou une chaîne numérique (« 3 »).
export const quantitySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number({ error: "Quantité invalide." }).int("Quantité invalide.").min(0, "Quantité invalide.").max(999, "Quantité invalide."),
);

// "", espaces ou null effacent le prix ; accepte la virgule décimale (« 12,50 »). Sortie : chaîne à 2 décimales.
const priceSchema = z
  .preprocess(
    (value) => {
      if (value === null || (typeof value === "string" && value.trim() === "")) return null;
      if (typeof value === "string") return Number(value.trim().replace(",", "."));
      return value;
    },
    z
      .number({ error: "Prix invalide." })
      .min(0, "Prix invalide.")
      .max(1_000_000, "Prix invalide.")
      .transform((amount) => amount.toFixed(2))
      .nullable(),
  )
  .optional();

const notesSchema = z
  .string({ error: "Notes invalides." })
  .nullable()
  .optional()
  .transform((value) => {
    if (value == null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 2000) : null;
  });

const currencySchema = z.enum(CURRENCIES, { error: "Devise invalide." }).nullable().optional();

/** Devise cohérente avec le prix : effacée avec lui, EUR par défaut quand un prix est donné. */
function resolveCurrency(currency: string | null | undefined, price: string | null | undefined) {
  if (currency === undefined && price === undefined) return undefined;
  if (price === null) return null;
  if (currency) return currency;
  return price ? "EUR" : undefined;
}

export const loginSchema = z.object({
  email: normalized(normalizeEmail, "Adresse e-mail ou mot de passe incorrect."),
  password: normalized(normalizeLoginPassword, "Adresse e-mail ou mot de passe incorrect."),
});

export const registerSchema = z.object({
  email: normalized(normalizeEmail, "Adresse e-mail invalide."),
  password: normalized(normalizePassword, "Le mot de passe doit contenir au moins 8 caractères."),
  displayName: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return null;
      const name = normalizeDisplayName(value);
      if (!name) {
        ctx.addIssue({ code: "custom", message: "Le nom affiché doit contenir entre 1 et 40 caractères." });
        return z.NEVER;
      }
      return name;
    }),
  localUserId: z.string().trim().max(128).nullable().optional(),
});

export const saveLineSchema = z
  .object({
    printingId: id,
    conditionCode: conditionCode.default("NM"),
    quantity: quantitySchema,
    mode: z.enum(["add", "set"]).default("add"),
    notes: notesSchema,
    purchasePrice: priceSchema,
    purchaseCurrency: currencySchema,
  })
  .transform((body) => ({ ...body, purchaseCurrency: resolveCurrency(body.purchaseCurrency, body.purchasePrice) }));

export const patchLineSchema = z
  .object({
    conditionCode: conditionCode.optional(),
    quantity: quantitySchema.optional(),
    notes: notesSchema,
    purchasePrice: priceSchema,
    purchaseCurrency: currencySchema,
  })
  .transform((body) => ({ ...body, purchaseCurrency: resolveCurrency(body.purchaseCurrency, body.purchasePrice) }));

export const bulkSchema = z.object({
  conditionCode: conditionCode.default("NM"),
  lines: z
    .array(z.object({ printingId: id, quantity: quantitySchema }))
    .max(400, "Trop de cartes d'un coup.")
    // Les lignes à 0 sont ignorées.
    .transform((lines) => lines.filter((line) => line.quantity > 0))
    .refine((lines) => lines.length > 0, "Aucune carte à ajouter."),
});

/** Import CSV : lignes déjà reconnues côté client (carte × état). Les champs absents ne sont pas modifiés. */
export const importSchema = z.object({
  mode: z.enum(["add", "set"]).default("add"),
  lines: z
    .array(
      z
        .object({
          printingId: id,
          conditionCode,
          quantity: quantitySchema,
          notes: notesSchema.transform((value) => value ?? undefined),
          purchasePrice: priceSchema.transform((value) => value ?? undefined),
          purchaseCurrency: z.enum(CURRENCIES, { error: "Devise invalide." }).optional(),
        })
        .transform((line) => ({
          ...line,
          purchaseCurrency: line.purchasePrice ? (line.purchaseCurrency ?? "EUR") : undefined,
        })),
    )
    .max(MAX_IMPORT_LINES, "Fichier trop volumineux.")
    .transform((lines) => lines.filter((line) => line.quantity > 0))
    .refine((lines) => lines.length > 0, "Aucune carte à importer."),
});

/** Liste de souhaits : prix cible en EUR (vide ou null = pas d'alerte). */
export const wishlistSaveSchema = z.object({
  printingId: id,
  targetPrice: priceSchema,
  notes: notesSchema,
});

export const wishlistPatchSchema = z.object({
  targetPrice: priceSchema,
  notes: notesSchema,
});

const deckNameSchema = z
  .string({ error: "Nom du deck invalide." })
  .trim()
  .min(1, "Donnez un nom au deck.")
  .max(60, "Nom du deck trop long (60 caractères maximum).");

/** Liste complète des cartes d'un deck (remplace l'existante). Un deck peut rester incomplet ou illégal. */
const deckCardsSchema = z
  .array(
    z.object({
      cardId: id,
      quantity: z.number({ error: "Quantité invalide." }).int("Quantité invalide.").min(1, "Quantité invalide.").max(9, "Quantité invalide."),
    }),
  )
  .max(150, "Trop de cartes différentes dans le deck.");

export const deckCreateSchema = z.object({
  name: deckNameSchema.optional(),
  cards: deckCardsSchema.optional(),
});

export const deckPatchSchema = z.object({
  name: deckNameSchema.optional(),
  notes: notesSchema,
  cards: deckCardsSchema.optional(),
});

export const shareSchema =z.object({ rotate: z.boolean().optional() }).nullable();

export const shareTokenSchema = z.string().min(16).max(128);

// --- Tournois -------------------------------------------------------------------------------

const intIn = (min: number, max: number, message: string) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message);

const tournamentNameSchema = z
  .string({ error: "Nom du tournoi invalide." })
  .trim()
  .min(1, "Donnez un nom au tournoi.")
  .max(60, "Nom du tournoi trop long (60 caractères maximum).");

const playerNameSchema = normalized(normalizePlayerName, "Le pseudo doit contenir entre 1 et 32 caractères.");

const tournamentSettingsFields = {
  name: tournamentNameSchema.optional(),
  format: z.enum(["boutique", "competitif"], { error: "Format invalide." }).optional(),
  matchType: z.enum(["bo1", "bo3"], { error: "Type de match invalide." }).optional(),
  roundMinutes: intIn(10, 180, "Durée de ronde invalide (10 à 180 minutes).").optional(),
  topCutExtraMinutes: intIn(0, 120, "Temps supplémentaire du top cut invalide (0 à 120 minutes).").optional(),
  topCutSetting: z.enum(TOP_CUT_SETTINGS, { error: "Taille de top cut invalide." }).optional(),
  requireApproval: z.boolean().optional(),
  oneDeviceMode: z.enum(["direct", "organizer"], { error: "Mode de validation invalide." }).optional(),
  declareTimeoutMinutes: intIn(1, 120, "Délai de confirmation invalide (1 à 120 minutes).").optional(),
  lateEntryPolicy: z.enum(["zero", "loss"], { error: "Règle des retardataires invalide." }).optional(),
};

export const tournamentCreateSchema = z.object({ ...tournamentSettingsFields, name: tournamentNameSchema });

const matchResultSchema = z
  .object({
    kind: z.enum(["normal", "id", "double_loss"], { error: "Résultat invalide." }).default("normal"),
    gamesA: intIn(0, 2, "Score invalide."),
    gamesB: intIn(0, 2, "Score invalide."),
  })
  .transform((result): MatchResult => result);

const clientActionId = z.string({ error: "Requête invalide." }).trim().min(8).max(64);
const entityId = id;

/** Commandes organisateur (POST /api/tournaments/[id]/actions), rejouables par la file hors connexion. */
export const organizerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("updateSettings"), clientActionId, settings: z.object({ ...tournamentSettingsFields, swissRounds: intIn(1, 20, "Nombre de rondes invalide (1 à 20).").optional() }) }),
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
    reason: z.string({ error: "Motif invalide." }).trim().min(1, "Indiquez un motif.").max(200, "Motif trop long."),
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
  z.object({ type: z.literal("adjustClock"), clientActionId, seconds: intIn(-7200, 7200, "Durée invalide.") }),
  z.object({ type: z.literal("addTableTime"), clientActionId, matchId: entityId, seconds: intIn(-3600, 3600, "Durée invalide.") }),
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

/** Inscription par code : pseudo obligatoire pour un invité, facultatif avec un compte. */
export const tournamentJoinSchema = z.object({ name: playerNameSchema.optional() });

export const tournamentTokenSchema = z.object({ token: shareTokenSchema });

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Valide une valeur ; renvoie une réponse 400 avec le premier message utile sinon. */
export function validate<S extends z.ZodType>(schema: S, value: unknown, status = 400): ParseResult<z.output<S>> {
  // Les messages non personnalisés (types inattendus, champs absents) deviennent « Requête invalide. ».
  const result = schema.safeParse(value, { error: () => INVALID_REQUEST });
  if (result.success) return { ok: true, data: result.data };
  const message = result.error.issues[0]?.message || INVALID_REQUEST;
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/** Lit le corps JSON puis le valide. Un corps absent ou mal formé vaut `null`. */
export async function readJsonBody<S extends z.ZodType>(request: Request, schema: S, status = 400) {
  const body: unknown = await request.json().catch(() => null);
  return validate(schema, body, status);
}
