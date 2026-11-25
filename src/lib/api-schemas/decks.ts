import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { id, notesSchema } from "./common";

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
