import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { MAX_IMPORT_LINES } from "../collection-csv";
import { CURRENCIES } from "../parse";
import { id, notesSchema, priceSchema } from "./common";

const conditionCode = z.string().trim().min(1).max(16);

// Accepte un nombre ou une chaîne numérique (« 3 »).
export const quantitySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number({ error: m("collection.invalidQuantity") }).int(m("collection.invalidQuantity")).min(0, m("collection.invalidQuantity")).max(999, m("collection.invalidQuantity")),
);

// Date d'achat « AAAA-MM-JJ » (jour calendaire réel, pas dans le futur) ; "" ou null efface la date.
const purchaseDateSchema = z
  .string({ error: m("collection.invalidPurchaseDate") })
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
      ctx.addIssue({ code: "custom", message: m("collection.invalidPurchaseDate") });
      return z.NEVER;
    }
    return text;
  });

const currencySchema = z.enum(CURRENCIES, { error: m("common.invalidCurrency") }).nullable().optional();

/** Devise cohérente avec le prix : effacée avec lui, EUR par défaut quand un prix est donné. */
function resolveCurrency(currency: string | null | undefined, price: string | null | undefined) {
  if (currency === undefined && price === undefined) return undefined;
  if (price === null) return null;
  if (currency) return currency;
  return price ? "EUR" : undefined;
}

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

/** Courbe d'investissement d'un ensemble d'exemplaires (sélection ou filtres du détail), doublons retirés. */
export const MAX_HISTORY_ITEMS = 20_000;
export const portfolioHistorySchema = z.object({
  items: z
    .array(id)
    .min(1)
    .max(MAX_HISTORY_ITEMS)
    .transform((ids) => [...new Set(ids)]),
});
