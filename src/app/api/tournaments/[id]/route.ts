import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { deleteTournament } from "@/lib/tournament/commands";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";
import { viewerFromRequest } from "@/lib/tournament/player-auth";
import { loadTournament } from "@/lib/tournament/repository";
import { buildView } from "@/lib/tournament/view";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const tournament = await loadTournament(prisma, id);
  if (!tournament) return apiError(request, "tournaments.notFound", 404);
  return NextResponse.json(buildView(tournament, await viewerFromRequest(request, id)));
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  try {
    await deleteTournament(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(request, "tournament-delete", error);
  }
}
