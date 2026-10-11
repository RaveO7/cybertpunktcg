import { NextResponse } from "next/server";
import { organizerCommandSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { runOrganizerCommand } from "@/lib/tournament/commands";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Commande organisateur, idempotente par `clientActionId` (file hors connexion). */
export async function POST(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  const { id } = await context.params;
  const parsed = await readJsonBody(request, organizerCommandSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await runOrganizerCommand(id, user.id, parsed.data));
  } catch (error) {
    return errorResponse("tournament-action", error);
  }
}
