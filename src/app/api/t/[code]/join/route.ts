import { prisma } from "@/lib/prisma";
import { normalizeTournamentCode } from "@/lib/tournament/code";
import { limitCodeAttempts } from "@/lib/tournament/http";
import { joinResponse } from "@/lib/tournament/join-http";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

/** Inscription avec un compte ou en invité ; l'appareil reste lié au joueur (cookie). */
export async function POST(request: Request, context: Context) {
  const limited = await limitCodeAttempts(request, "tournament-join");
  if (limited) return limited;
  const code = normalizeTournamentCode((await context.params).code);
  const row = code ? await prisma.tournament.findUnique({ where: { code }, select: { id: true } }) : null;
  if (!row) return apiError(request, "tournaments.notFound", 404);
  return joinResponse(request, row.id);
}
