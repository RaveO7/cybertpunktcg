import { NextResponse } from "next/server";
import { isCountryCode } from "@/lib/geo/location";
import { directoryFacets } from "@/lib/tournament/directory";

export const dynamic = "force-dynamic";

/** Pays, puis régions et villes du pays choisi, ayant des tournois publics à venir. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const country = params.get("country")?.toUpperCase();
  const region = params.get("region")?.slice(0, 100) || undefined;
  return NextResponse.json(await directoryFacets(isCountryCode(country) ? country : undefined, region));
}
