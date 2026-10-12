import { NextResponse } from "next/server";
import { directoryQuerySchema, validateSearchParams } from "@/lib/api-schemas";
import { directoryQueryFromParams, searchPublicTournaments } from "@/lib/tournament/directory";

export const dynamic = "force-dynamic";

/** Annuaire public des tournois (sans compte), filtres en paramètres d'URL. */
export async function GET(request: Request) {
  const parsed = validateSearchParams(directoryQuerySchema, new URL(request.url).searchParams);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(await searchPublicTournaments(directoryQueryFromParams(parsed.data)));
}
