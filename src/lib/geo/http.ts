// Réponses HTTP communes aux routes de géocodage.

import { NextResponse } from "next/server";
import { reportError } from "@/lib/monitoring";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { GeocodeUnavailableError } from "./geocode";

/** 30 recherches par minute et par IP (cf. specs/locations/geocoding). */
export async function limitGeocode(request: Request) {
  const limited = await rateLimit(clientKey(request, "geocode"), 30, 60_000);
  if (limited.ok) return null;
  return NextResponse.json(
    { error: "Trop de recherches. Réessayez dans une minute." },
    { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) } },
  );
}

export async function geocodeErrorResponse(error: unknown) {
  if (!(error instanceof GeocodeUnavailableError)) await reportError("geocode", error);
  const message = error instanceof GeocodeUnavailableError ? error.message : "Service de localisation indisponible, réessayez dans un instant.";
  return NextResponse.json({ error: message, retry: true }, { status: 503 });
}
