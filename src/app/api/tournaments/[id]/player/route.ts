import { NextResponse } from "next/server";
import { playerCommandSchema, readJsonBody } from "@/lib/api-schemas";
import { errorResponse } from "@/lib/tournament/http";
import { viewerFromRequest } from "@/lib/tournament/player-auth";
import { runPlayerCommand } from "@/lib/tournament/player-commands";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Commande d'un joueur, identifié par son compte ou par l'appareil lié (cookie). */
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const parsed = await readJsonBody(request, playerCommandSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await runPlayerCommand(id, await viewerFromRequest(request, id), parsed.data));
  } catch (error) {
    return errorResponse(request, "tournament-player", error);
  }
}
