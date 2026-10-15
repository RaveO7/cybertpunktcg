import { NextResponse } from "next/server";
import { readJsonBody, tournamentTokenSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { errorResponse, limitCodeAttempts } from "@/lib/tournament/http";
import { claimPlayer, setPlayerCookie } from "@/lib/tournament/player-auth";

export const dynamic = "force-dynamic";

/** Récupération d'un profil par QR personnel (usage unique, 15 minutes). */
export async function POST(request: Request) {
  const limited = await limitCodeAttempts(request, "tournament-claim");
  if (limited) return limited;
  const parsed = await readJsonBody(request, tournamentTokenSchema);
  if (!parsed.ok) return parsed.response;
  const user = await requireUser(request);
  try {
    const claimed = await claimPlayer(parsed.data.token, user?.id ?? null);
    const response = NextResponse.json({ tournamentId: claimed.tournamentId, code: claimed.code, playerId: claimed.playerId });
    setPlayerCookie(response, request, claimed.tournamentId, claimed.deviceToken);
    return response;
  } catch (error) {
    return errorResponse(request, "tournament-claim", error);
  }
}
