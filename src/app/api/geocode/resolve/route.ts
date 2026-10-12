import { NextResponse } from "next/server";
import { geocodeResolveSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { geocodeErrorResponse, limitGeocode } from "@/lib/geo/http";
import { geocoder } from "@/lib/geo/server";
import { sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

/** Localise une adresse saisie en entier (bouton « Localiser »), tous pays. */
export async function POST(request: Request) {
  if (!(await requireUser(request))) return sessionRequired();
  const limited = await limitGeocode(request);
  if (limited) return limited;
  const parsed = await readJsonBody(request, geocodeResolveSchema);
  if (!parsed.ok) return parsed.response;
  const { country, ...parts } = parsed.data;
  try {
    const place = await geocoder.resolveAddress(parts, country);
    if (!place) return NextResponse.json({ error: "Adresse introuvable : vérifiez la rue, le code postal et la ville." }, { status: 404 });
    return NextResponse.json({ place });
  } catch (error) {
    return geocodeErrorResponse(error);
  }
}
