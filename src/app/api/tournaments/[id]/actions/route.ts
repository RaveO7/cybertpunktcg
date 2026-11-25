import { after, NextResponse } from "next/server";
import { organizerCommandSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { runOrganizerCommand } from "@/lib/tournament/commands";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";
import { sendTournamentNotifications } from "@/lib/tournament/notifications";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Commande organisateur, idempotente par `clientActionId` (file hors connexion). */
export async function POST(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  const parsed = await readJsonBody(request, organizerCommandSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await runOrganizerCommand(id, user.id, parsed.data, {
      // Notifications des joueurs envoyées après la réponse : l'organisateur n'attend pas le service push.
      onEvents: (events) => after(() => sendTournamentNotifications(events)),
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(request, "tournament-action", error);
  }
}
