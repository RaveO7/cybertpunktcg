import { NextResponse } from "next/server";
import { findPublicTournament } from "@/lib/tournament/directory";
import { buildPublicView } from "@/lib/tournament/public-view";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Fiche publique d'un tournoi public (sans code ni données privées). */
export async function GET(request: Request, context: Context) {
  const t = await findPublicTournament((await context.params).id);
  if (!t) return apiError(request, "tournaments.notFound", 404);
  return NextResponse.json(buildPublicView(t));
}
