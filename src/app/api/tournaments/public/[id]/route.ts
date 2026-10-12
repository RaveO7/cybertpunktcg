import { NextResponse } from "next/server";
import { findPublicTournament } from "@/lib/tournament/directory";
import { buildPublicView } from "@/lib/tournament/public-view";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Fiche publique d'un tournoi public (sans code ni données privées). */
export async function GET(_request: Request, context: Context) {
  const t = await findPublicTournament((await context.params).id);
  if (!t) return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  return NextResponse.json(buildPublicView(t));
}
