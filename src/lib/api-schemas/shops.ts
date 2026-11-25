import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { normalizeEmail } from "../auth";
import { optionalText } from "./common";
import { placeSchema } from "./geo";

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
