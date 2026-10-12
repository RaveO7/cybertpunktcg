// Inscription HTTP commune à l'entrée par code (/api/t/[code]/join) et à la fiche publique
// (/api/tournaments/public/[id]/join) : mêmes règles, même cookie d'appareil.

import { NextResponse } from "next/server";
import { readJsonBody, tournamentJoinSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { errorResponse } from "./http";
import { joinTournament } from "./join";
import { setPlayerCookie, viewerFromRequest } from "./player-auth";

export async function joinResponse(request: Request, tournamentId: string, extra: Record<string, unknown> = {}) {
  const parsed = await readJsonBody(request, tournamentJoinSchema);
  if (!parsed.ok) return parsed.response;
  const user = await requireUser(request);
  const viewer = await viewerFromRequest(request, tournamentId);
  try {
    const result = await joinTournament(tournamentId, { ...viewer, displayName: user?.displayName ?? null }, parsed.data.name);
    const response = NextResponse.json(
      { tournamentId, playerId: result.playerId, existing: result.existing, status: result.status, ...extra },
      { status: result.existing ? 200 : 201 },
    );
    if (result.deviceToken) setPlayerCookie(response, request, tournamentId, result.deviceToken);
    return response;
  } catch (error) {
    return errorResponse("tournament-join", error);
  }
}
