import { NextResponse } from "next/server";
import { readJsonBody, tournamentCreateSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { limitUserWrites } from "@/lib/rate-limit-http";
import { createTournament, listTournaments } from "@/lib/tournament/commands";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  return NextResponse.json({ tournaments: await listTournaments(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const limited = await limitUserWrites(request, "tournament-create", user.id, 20, 10 * 60_000);
  if (limited) return limited;
  const parsed = await readJsonBody(request, tournamentCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ tournament: await createTournament(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return errorResponse(request, "tournament-create", error);
  }
}
