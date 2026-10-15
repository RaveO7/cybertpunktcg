import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { geocodeErrorResponse, limitGeocode } from "@/lib/geo/http";
import { isCountryCode } from "@/lib/geo/location";
import { geocoder } from "@/lib/geo/server";
import { sessionRequired } from "@/lib/tournament/http";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Suggestions d'adresses pendant la saisie (France uniquement). Organisateurs et gérants. */
export async function GET(request: Request) {
  if (!(await requireUser(request))) return sessionRequired(request);
  const limited = await limitGeocode(request);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").slice(0, 200);
  const country = (params.get("country") ?? "FR").toUpperCase();
  if (!isCountryCode(country)) return apiError(request, "common.invalidCountry", 400);
  try {
    return NextResponse.json({ suggestions: await geocoder.suggestAddresses(q, country) });
  } catch (error) {
    return geocodeErrorResponse(request, error);
  }
}
