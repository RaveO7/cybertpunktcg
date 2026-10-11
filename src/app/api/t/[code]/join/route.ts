import { NextResponse } from "next/server";
import { readJsonBody, tournamentJoinSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { normalizeTournamentCode } from "@/lib/tournament/code";
import { errorResponse, limitCodeAttempts } from "@/lib/tournament/http";
import { joinTournament } from "@/lib/tournament/join";
import { setPlayerCookie, viewerFromRequest } from "@/lib/tournament/player-auth";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

/** Inscription avec un compte ou en invité ; l'appareil reste lié au joueur (cookie). */
export async function POST(request: Request, context: Context) {
  const limited = await limitCodeAttempts(request, "tournament-join");
  if (limited) return limited;
  const code = normalizeTournamentCode((await context.params).code);
  const row = code ? await prisma.tournament.findUnique({ where: { code }, select: { id: true } }) : null;
  if (!row) return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  const parsed = await readJsonBody(request, tournamentJoinSchema);
  if (!parsed.ok) return parsed.response;
  const user = await requireUser(request);
  const viewer = await viewerFromRequest(request, row.id);
  try {
    const result = await joinTournament(row.id, { ...viewer, displayName: user?.displayName ?? null }, parsed.data.name);
    const response = NextResponse.json(
      { tournamentId: row.id, playerId: result.playerId, existing: result.existing, status: result.status },
      { status: result.existing ? 200 : 201 },
    );
    if (result.deviceToken) setPlayerCookie(response, request, row.id, result.deviceToken);
    return response;
  } catch (error) {
    return errorResponse("tournament-join", error);
  }
}
