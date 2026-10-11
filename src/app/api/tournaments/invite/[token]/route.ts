import { NextResponse } from "next/server";
import { shareTokenSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { acceptOrganizerInvite } from "@/lib/tournament/commands";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

/** Accepte une invitation de co-organisateur (compte requis, usage unique). */
export async function POST(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  const { token } = await context.params;
  if (!shareTokenSchema.safeParse(token).success) {
    return NextResponse.json({ error: "Invitation invalide ou expirée." }, { status: 404 });
  }
  try {
    return NextResponse.json(await acceptOrganizerInvite(token, user.id));
  } catch (error) {
    return errorResponse("tournament-invite", error);
  }
}
