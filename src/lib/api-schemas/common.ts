// Briques partagées par les schémas d'entrée de plusieurs domaines.
import { z } from "zod";
import { apiMessage as m } from "../app-error";

/** Applique une fonction de normalisation existante (null = invalide) avec un message dédié. */
export function normalized<T>(normalize: (value: unknown) => T | null, message: string) {
  return z.string({ error: message }).transform((value, ctx) => {
    const result = normalize(value);
    if (result === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return result;
  });
}

export const id = z.string().trim().min(1).max(128);

export const intIn = (min: number, max: number, message: string) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message);

// "", espaces ou null effacent le prix ; accepte la virgule décimale (« 12,50 »). Sortie : chaîne à 2 décimales.
export const priceSchema = z
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

export const notesSchema = z
  .string({ error: m("collection.invalidNotes") })
  .nullable()
  .optional()
  .transform((value) => {
    if (value == null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 2000) : null;
  });

/** Texte facultatif : vide → null, trop long → refusé avec `message`. */
export const optionalText = (max: number, message: string) =>
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
