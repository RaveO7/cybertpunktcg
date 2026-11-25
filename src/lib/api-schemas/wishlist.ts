import { z } from "zod";
import { id, notesSchema, priceSchema } from "./common";

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

export const wishlistPatchSchema = z.object({
  targetPrice: priceSchema,
  notes: notesSchema,
});
