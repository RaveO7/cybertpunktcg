import { NextResponse } from "next/server";
import type { CitySuggestion } from "@/lib/geo/geocode";
import { limitGeocode } from "@/lib/geo/http";
import { cityKey } from "@/lib/geo/location";
import { geocoder, knownCities } from "@/lib/geo/server";

export const dynamic = "force-dynamic";

/**
 * Villes pour la recherche « autour de… » de l'annuaire (public) : villes ayant des tournois
 * ou des boutiques, puis communes françaises. Jamais de requête vers Nominatim ici.
 */
export async function GET(request: Request) {
  const limited = await limitGeocode(request);
  if (limited) return limited;
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  const known = await knownCities(q);
  let french: CitySuggestion[] = [];
  try {
    french = await geocoder.suggestFrenchCities(q);
  } catch {
    // Service IGN indisponible : les villes connues suffisent.
  }
  const seen = new Set(known.map((city) => `${city.country}:${cityKey(city.city)}`));
  const cities = [...known, ...french.filter((city) => !seen.has(`${city.country}:${cityKey(city.city)}`))].slice(0, 10);
  return NextResponse.json({ cities });
}
