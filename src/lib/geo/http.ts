// Réponses HTTP communes aux routes de géocodage.

import { NextResponse } from "next/server";
import { apiError, apiText } from "@/lib/api-response";
import { reportError } from "@/lib/monitoring";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { GeocodeUnavailableError } from "./geocode";

/** 30 recherches par minute et par IP (cf. specs/locations/geocoding). */
export async function limitGeocode(request: Request) {
  const limited = await rateLimit(clientKey(request, "geocode"), 30, 60_000);
  if (limited.ok) return null;
  return apiError(request, "geo.tooManySearches", 429, {
    headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) },
  });
}

export async function geocodeErrorResponse(request: Request, error: unknown) {
  if (!(error instanceof GeocodeUnavailableError)) await reportError("geocode", error);
  const key = error instanceof GeocodeUnavailableError ? error.key : "geo.unavailable";
  return NextResponse.json({ error: await apiText(request, key), retry: true }, { status: 503 });
}
