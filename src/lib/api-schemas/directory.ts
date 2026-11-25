import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { SEARCH_RADII_KM } from "../tournament/listing";
import { countrySchema } from "./geo";

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
