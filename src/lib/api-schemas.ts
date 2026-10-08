// Schémas Zod des entrées des routes API. Toute nouvelle route qui lit un corps JSON
// doit passer par readJsonBody(request, schéma) : pas de parsing manuel.
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDisplayName, normalizeEmail, normalizeLoginPassword, normalizePassword } from "./auth";
import { CURRENCIES } from "./parse";

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

// "" ou null efface le prix ; accepte la virgule décimale (« 12,50 »). Sortie : chaîne à 2 décimales.
const priceSchema = z
  .preprocess(
    (value) => {
      if (value === "" || value === null) return null;
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

export const shareSchema = z.object({ rotate: z.boolean().optional() }).nullable();

export const shareTokenSchema = z.string().min(16).max(128);

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
