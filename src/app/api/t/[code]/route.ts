import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTournamentCode } from "@/lib/tournament/code";
import { limitCodeAttempts } from "@/lib/tournament/http";
import { viewerFromRequest } from "@/lib/tournament/player-auth";
import { loadTournamentByCode } from "@/lib/tournament/repository";
import { buildView } from "@/lib/tournament/view";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

/** Tournoi correspondant au code saisi ou scanné (limité en débit : les codes ne se devinent pas). */
export async function GET(request: Request, context: Context) {
  const limited = await limitCodeAttempts(request, "tournament-code");
  if (limited) return limited;
  const code = normalizeTournamentCode((await context.params).code);
  const tournament = code ? await loadTournamentByCode(prisma, code) : null;
  if (!tournament) return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  return NextResponse.json(buildView(tournament, await viewerFromRequest(request, tournament.id)));
}
