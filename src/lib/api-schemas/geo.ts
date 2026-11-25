import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { normalizePlace, type Place } from "../geo/location";

export const countrySchema = z
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
