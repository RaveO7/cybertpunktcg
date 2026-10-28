// Schémas Zod des entrées des routes API. Toute nouvelle route qui lit un corps JSON
// doit passer par readJsonBody(request, schéma) : pas de parsing manuel.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "./api-response";
import { apiMessage as m, decodeApiMessage, type ApiMessageKey, type ApiMessageValues } from "./app-error";
import { normalizeDisplayName, normalizeEmail, normalizeLoginPassword, normalizePassword } from "./auth";
import { MAX_IMPORT_LINES } from "./collection-csv";
import { normalizePlace, type Place } from "./geo/location";
import { CURRENCIES } from "./parse";
import { normalizePlayerName } from "./tournament/code";
import { DESCRIPTION_MAX, PRIZES_MAX, SEARCH_RADII_KM, TOURNAMENT_CURRENCIES } from "./tournament/listing";
import type { MatchResult } from "./tournament/scores";
import { TOP_CUT_SETTINGS } from "./tournament/top-cut";

const INVALID_REQUEST = m("common.invalidRequest");

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
  z.number({ error: m("collection.invalidQuantity") }).int(m("collection.invalidQuantity")).min(0, m("collection.invalidQuantity")).max(999, m("collection.invalidQuantity")),
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
      .number({ error: m("collection.invalidPrice") })
      .min(0, m("collection.invalidPrice"))
      .max(1_000_000, m("collection.invalidPrice"))
      .transform((amount) => amount.toFixed(2))
      .nullable(),
  )
  .optional();

const notesSchema = z
  .string({ error: m("collection.invalidNotes") })
  .nullable()
  .optional()
  .transform((value) => {
    if (value == null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 2000) : null;
  });

// Jour « AAAA-MM-JJ » (jour calendaire réel, pas dans le futur) ; "" ou null efface la date.
function pastDaySchema(message: string) {
  return z
    .string({ error: message })
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (value == null) return value;
      const text = value.trim();
      if (text === "") return null;
      const date = new Date(`${text}T00:00:00.000Z`);
      // Un jour d'avance toléré : la date locale de l'utilisateur peut précéder le jour UTC.
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const valid =
        /^\d{4}-\d{2}-\d{2}$/.test(text) &&
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === text &&
        text >= "1990-01-01" &&
        text <= tomorrow;
      if (!valid) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return text;
    });
}

const purchaseDateSchema = pastDaySchema(m("collection.invalidPurchaseDate"));

const currencySchema = z.enum(CURRENCIES, { error: m("common.invalidCurrency") }).nullable().optional();

/** Devise cohérente avec le prix : effacée avec lui, EUR par défaut quand un prix est donné. */
function resolveCurrency(currency: string | null | undefined, price: string | null | undefined) {
  if (currency === undefined && price === undefined) return undefined;
  if (price === null) return null;
  if (currency) return currency;
  return price ? "EUR" : undefined;
}

export const loginSchema = z.object({
  email: normalized(normalizeEmail, m("auth.invalidCredentials")),
  password: normalized(normalizeLoginPassword, m("auth.invalidCredentials")),
});

export const registerSchema = z.object({
  email: normalized(normalizeEmail, m("auth.invalidEmail")),
  password: normalized(normalizePassword, m("auth.passwordTooShort", { min: 8 })),
  displayName: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return null;
      const name = normalizeDisplayName(value);
      if (!name) {
        ctx.addIssue({ code: "custom", message: m("auth.displayNameLength", { min: 1, max: 40 }) });
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
    purchasedAt: purchaseDateSchema,
  })
  .transform((body) => ({ ...body, purchaseCurrency: resolveCurrency(body.purchaseCurrency, body.purchasePrice) }));

export const patchLineSchema = z
  .object({
    conditionCode: conditionCode.optional(),
    quantity: quantitySchema.optional(),
    notes: notesSchema,
    purchasePrice: priceSchema,
    purchaseCurrency: currencySchema,
    purchasedAt: purchaseDateSchema,
  })
  .transform((body) => ({ ...body, purchaseCurrency: resolveCurrency(body.purchaseCurrency, body.purchasePrice) }));

export const bulkSchema = z.object({
  conditionCode: conditionCode.default("NM"),
  lines: z
    .array(z.object({ printingId: id, quantity: quantitySchema }))
    .max(400, m("collection.tooManyCards"))
    // Les lignes à 0 sont ignorées.
    .transform((lines) => lines.filter((line) => line.quantity > 0))
    .refine((lines) => lines.length > 0, m("collection.nothingToAdd")),
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
          purchaseCurrency: z.enum(CURRENCIES, { error: m("common.invalidCurrency") }).optional(),
          purchasedAt: purchaseDateSchema.transform((value) => value ?? undefined),
        })
        .transform((line) => ({
          ...line,
          purchaseCurrency: line.purchasePrice ? (line.purchaseCurrency ?? "EUR") : undefined,
        })),
    )
    .max(MAX_IMPORT_LINES, m("collection.fileTooLarge"))
    .transform((lines) => lines.filter((line) => line.quantity > 0))
    .refine((lines) => lines.length > 0, m("collection.nothingToImport")),
});

/** Liste de souhaits : prix cible en EUR (vide ou null = pas d'alerte). */
export const wishlistSaveSchema = z.object({
  printingId: id,
  targetPrice: priceSchema,
  notes: notesSchema,
});

/** Ajout groupé (cartes manquantes d'un deck) : 200 tirages au plus, doublons retirés. */
export const MAX_WISHLIST_BULK = 200;
export const wishlistBulkSchema = z.object({
  printingIds: z
    .array(id)
    .min(1)
    .max(MAX_WISHLIST_BULK)
    .transform((ids) => [...new Set(ids)]),
});

/** Courbe d'investissement d'un ensemble d'exemplaires (sélection ou filtres du détail), doublons retirés. */
export const MAX_HISTORY_ITEMS = 20_000;
export const portfolioHistorySchema = z.object({
  items: z
    .array(id)
    .min(1)
    .max(MAX_HISTORY_ITEMS)
    .transform((ids) => [...new Set(ids)]),
});

// Vente : prix de vente total obligatoire, frais facultatifs (0), date de vente obligatoire.
const salePriceSchema = priceSchema.refine((value) => value != null, m("investment.invalidSalePrice"));
const feesSchema = priceSchema.transform((value) => value ?? "0.00");
const saleDaySchema = pastDaySchema(m("investment.invalidSaleDate"));
const saleCurrencySchema = z.enum(CURRENCIES, { error: m("common.invalidCurrency") });

/** Vente d'exemplaires d'une ligne de la collection. */
export const saleCreateSchema = z.object({
  itemId: id,
  quantity: quantitySchema.refine((quantity) => quantity >= 1, m("collection.invalidQuantity")),
  salePrice: salePriceSchema.transform((value) => value as string),
  saleCurrency: saleCurrencySchema.default("EUR"),
  fees: feesSchema,
  soldAt: saleDaySchema.refine((value) => value != null, m("investment.invalidSaleDate")).transform((value) => value as string),
});

/** Correction d'une vente : seuls les champs envoyés changent. */
export const salePatchSchema = z.object({
  salePrice: salePriceSchema.optional().transform((value) => value ?? undefined),
  saleCurrency: saleCurrencySchema.optional(),
  fees: priceSchema.transform((value) => (value === null ? "0.00" : value)),
  soldAt: saleDaySchema.refine((value) => value !== null, m("investment.invalidSaleDate")).transform((value) => value ?? undefined),
});

/** Alerte de revente : prix visé en EUR, strictement positif. */
export const sellAlertSaveSchema = z.object({
  printingId: id,
  targetPrice: priceSchema
    .refine((value) => value != null && Number(value) > 0, m("investment.invalidTargetPrice"))
    .transform((value) => value as string),
});

/** Taux de change demandés : clés « USD:2024-03-01 » (voir rateKey), doublons retirés. */
export const MAX_RATE_KEYS = 5000;
export const exchangeRatesSchema = z.object({
  keys: z
    .array(z.string().regex(/^[A-Z]{3}:\d{4}-\d{2}-\d{2}$/))
    .max(MAX_RATE_KEYS)
    .transform((keys) => [...new Set(keys)]),
});

/** Clé d'un abonnement Web Push (base64url). */
const pushKey = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_=-]+$/);
const pushEndpoint = z.url({ protocol: /^https$/ }).max(2048);

/** Abonnement Web Push d'un appareil (`PushSubscription.toJSON()`), et langue des notifications. */
export const pushSubscribeSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: pushKey, auth: pushKey }),
  locale: z.string().max(8).optional(),
});

export const pushUnsubscribeSchema = z.object({ endpoint: pushEndpoint });

export const wishlistPatchSchema = z.object({
  targetPrice: priceSchema,
  notes: notesSchema,
});

const deckNameSchema = z
  .string({ error: m("decks.invalidName") })
  .trim()
  .min(1, m("decks.nameRequired"))
  .max(60, m("decks.nameTooLong", { max: 60 }));

/** Liste complète des cartes d'un deck (remplace l'existante). Un deck peut rester incomplet ou illégal. */
const deckCardsSchema = z
  .array(
    z.object({
      cardId: id,
      quantity: z.number({ error: m("collection.invalidQuantity") }).int(m("collection.invalidQuantity")).min(1, m("collection.invalidQuantity")).max(9, m("collection.invalidQuantity")),
    }),
  )
  .max(150, m("decks.tooManyCards"));

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

/** Suppression du compte : confirmation explicite exigée dans le corps, jamais sur un simple appel. */
export const deleteAccountSchema = z.object({ confirm: z.literal(true) });

// --- Tournois -------------------------------------------------------------------------------

const intIn = (min: number, max: number, message: string) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message);

const tournamentNameSchema = z
  .string({ error: m("tournaments.invalidName") })
  .trim()
  .min(1, m("tournaments.nameRequired"))
  .max(60, m("tournaments.nameTooLong", { max: 60 }));

const playerNameSchema = normalized(normalizePlayerName, m("tournaments.pseudoLength", { min: 1, max: 32 }));

const tournamentSettingsFields = {
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

const matchResultSchema = z
  .object({
    kind: z.enum(["normal", "id", "double_loss"], { error: m("tournaments.invalidResult") }).default("normal"),
    gamesA: intIn(0, 2, m("tournaments.invalidScore")),
    gamesB: intIn(0, 2, m("tournaments.invalidScore")),
  })
  .transform((result): MatchResult => result);

// --- Lieux, tournois publics, boutiques ------------------------------------------------------

const countrySchema = z
  .string({ error: m("common.invalidCountry") })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, m("common.invalidCountry"));

/** Lieu déjà résolu par le géocodage (suggestion choisie ou « Localiser »). */
export const placeSchema = z
  .object({
    venueName: z.string().max(100, m("geo.venueTooLong", { max: 100 })).nullable().optional(),
    address: z.string({ error: m("geo.invalidAddress") }).max(200, m("geo.addressTooLong")),
    postalCode: z.string().max(20, m("geo.invalidPostalCode")).nullable().optional(),
    city: z.string({ error: m("geo.invalidCity") }).max(100, m("geo.cityTooLong")),
    region: z.string().max(100).nullable().optional(),
    country: countrySchema,
    lat: z.number({ error: m("geo.notLocated") }).min(-90).max(90),
    lng: z.number({ error: m("geo.notLocated") }).min(-180).max(180),
  })
  .transform((value, ctx): Place => {
    const place = normalizePlace(value);
    if (!place) {
      ctx.addIssue({ code: "custom", message: m("geo.incompletePlace") });
      return z.NEVER;
    }
    return place;
  });

export const geocodeResolveSchema = z.object({
  country: countrySchema,
  street: z.string({ error: m("geo.invalidAddress") }).trim().min(1, m("geo.streetRequired")).max(200, m("geo.addressTooLong")),
  postalCode: z.string().trim().max(20, m("geo.invalidPostalCode")).optional(),
  city: z.string({ error: m("geo.invalidCity") }).trim().min(1, m("geo.cityRequired")).max(100, m("geo.cityTooLong")),
});


/** Texte facultatif : vide → null, trop long → refusé avec `message`. */
const optionalText = (max: number, message: string) =>
  z
    .string({ error: message })
    .transform((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed.length > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return trimmed || null;
    })
    .nullable()
    .optional();

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

const httpUrlSchema = z
  .string({ error: m("common.invalidLink") })
  .trim()
  .max(300, m("shops.linkTooLong"))
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, m("shops.linkProtocol"));

export const SHOP_SOCIAL_KINDS = ["instagram", "facebook", "discord", "x", "youtube", "twitch", "tiktok", "autre"] as const;

const shopNameSchema = z
  .string({ error: m("shops.invalidName") })
  .trim()
  .min(2, m("shops.nameTooShort", { min: 2 }))
  .max(80, m("shops.nameTooLong", { max: 80 }));

const shopFields = {
  name: shopNameSchema,
  slug: z
    .string({ error: m("shops.invalidSlug") })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, m("shops.invalidSlugChars"))
    .min(2, m("shops.slugTooShort"))
    .max(60, m("shops.slugTooLong")),
  description: optionalText(2000, m("shops.descriptionTooLong", { max: 2000 })),
  website: httpUrlSchema.nullable().optional().or(z.literal("").transform(() => null)),
  socials: z
    .array(z.object({ kind: z.enum(SHOP_SOCIAL_KINDS, { error: m("shops.invalidSocial") }), url: httpUrlSchema }))
    .max(8, m("shops.tooManyLinks", { max: 8 }))
    .optional(),
  phone: optionalText(30, m("shops.invalidPhone")),
  contactEmail: z
    .string({ error: m("shops.invalidEmail") })
    .trim()
    .max(254)
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const email = normalizeEmail(value);
      if (!email) {
        ctx.addIssue({ code: "custom", message: m("shops.invalidContactEmail") });
        return z.NEVER;
      }
      return email;
    }),
  hours: optionalText(500, m("shops.hoursTooLong", { max: 500 })),
  place: placeSchema,
};

export const shopCreateSchema = z.object({ ...shopFields, slug: shopFields.slug.optional() });
export const shopUpdateSchema = z.object({
  ...shopFields,
  name: shopFields.name.optional(),
  slug: shopFields.slug.optional(),
  place: shopFields.place.optional(),
  /** Boutique refusée corrigée : la soumettre de nouveau à la vérification. */
  resubmit: z.boolean().optional(),
});
export type ShopCreateInput = z.output<typeof shopCreateSchema>;
export type ShopUpdateInput = z.output<typeof shopUpdateSchema>;

export const shopReviewSchema = z
  .object({
    decision: z.enum(["verify", "reject", "revoke"], { error: m("shops.invalidDecision") }),
    note: z.string().trim().max(500, m("shops.noteTooLong", { max: 500 })).optional(),
  })
  .refine((value) => value.decision === "verify" || Boolean(value.note), {
    message: m("shops.noteRequired"),
    path: ["note"],
  });

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


/** Paramètre d'URL facultatif : absent ou vide → undefined. */
const param = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value) => (value === null || value === "" ? undefined : value), schema.optional());

const numberParam = (min: number, max: number) =>
  param(z.coerce.number({ error: m("common.invalidParam") }).min(min, m("common.invalidParam")).max(max, m("common.invalidParam")));

const dayParam = param(z.iso.datetime({ offset: true, error: m("common.invalidDate") }).or(z.iso.date({ error: m("common.invalidDate") })));

const flagParam = param(z.enum(["1", "0", "true", "false"]).transform((value) => value === "1" || value === "true"));

/** Point de recherche : les trois paramètres ensemble, rayon parmi les valeurs proposées. */
const nearParams = {
  lat: numberParam(-90, 90),
  lng: numberParam(-180, 180),
  radius: param(
    z.coerce
      .number({ error: m("geo.invalidRadius") })
      .refine((value) => (SEARCH_RADII_KM as readonly number[]).includes(value), m("geo.invalidRadius")),
  ),
};

function withNear<T extends { lat?: number; lng?: number; radius?: number }>(value: T, ctx: z.RefinementCtx) {
  const { lat, lng, radius, ...rest } = value;
  const given = [lat, lng].filter((part) => part !== undefined).length;
  if (given === 1) ctx.addIssue({ code: "custom", message: m("geo.incompleteSearchPoint") });
  return {
    ...rest,
    near: lat !== undefined && lng !== undefined ? { lat, lng, radiusKm: radius ?? 25 } : undefined,
  };
}

/** Filtres de l'annuaire des tournois publics (paramètres d'URL), cf. specs/tournaments/discovery. */
export const directoryQuerySchema = z
  .object({
    country: param(countrySchema),
    region: param(z.string().trim().max(100)),
    city: param(z.string().trim().max(100)),
    ...nearParams,
    from: dayParam,
    to: dayParam,
    format: param(z.enum(["boutique", "competitif"], { error: m("tournaments.invalidFormat") })),
    match: param(z.enum(["bo1", "bo3"], { error: m("tournaments.invalidMatchType") })),
    price: param(z.enum(["free", "paid"], { error: m("directory.invalidPriceFilter") })),
    seats: flagParam,
    open: flagParam,
    shop: param(z.string().trim().toLowerCase().max(60)),
    sort: param(z.enum(["date", "distance"], { error: m("directory.invalidSort") })),
    page: numberParam(1, 1000),
    view: param(z.enum(["list", "map"], { error: m("directory.invalidView") })),
  })
  .transform((value, ctx) => withNear(value, ctx));

export const shopDirectoryQuerySchema = z
  .object({
    country: param(countrySchema),
    city: param(z.string().trim().max(100)),
    ...nearParams,
    page: numberParam(1, 1000),
  })
  .transform((value, ctx) => withNear(value, ctx));

/** Lit les paramètres d'URL (une valeur par clé) puis les valide. */
export function validateSearchParams<S extends z.ZodType>(schema: S, params: URLSearchParams) {
  return validate(schema, Object.fromEntries(params.entries()));
}

/** Inscription par code : pseudo obligatoire pour un invité, facultatif avec un compte. */
export const tournamentJoinSchema = z.object({ name: playerNameSchema.optional() });

export const tournamentTokenSchema = z.object({ token: shareTokenSchema });

export type ValidationFailure = { key: ApiMessageKey; values?: ApiMessageValues; status: number };

type ParseResult<T> = { ok: true; data: T } | { ok: false; failure: ValidationFailure };

/** Valide une valeur ; renvoie sinon le premier message utile (clé du bloc `api`) et le statut. */
export function validate<S extends z.ZodType>(schema: S, value: unknown, status = 400): ParseResult<z.output<S>> {
  // Les messages non personnalisés (types inattendus, champs absents) deviennent « Requête invalide. ».
  const result = schema.safeParse(value, { error: () => INVALID_REQUEST });
  if (result.success) return { ok: true, data: result.data };
  const decoded = decodeApiMessage(result.error.issues[0]?.message ?? "") ?? { key: "common.invalidRequest" };
  return { ok: false, failure: { ...decoded, status } };
}

/** Réponse `{ error }` traduite d'une validation refusée. */
export function validationError(request: Request, failure: ValidationFailure) {
  return apiError(request, failure.key, failure.status, { values: failure.values });
}

/** Lit le corps JSON puis le valide. Un corps absent ou mal formé vaut `null`. */
export async function readJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  status = 400,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = validate(schema, body, status);
  return parsed.ok ? parsed : { ok: false, response: await validationError(request, parsed.failure) };
}
