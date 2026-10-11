import { NextResponse } from "next/server";
import { readJsonBody, tournamentCreateSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { createTournament, listTournaments } from "@/lib/tournament/commands";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  return NextResponse.json({ tournaments: await listTournaments(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  const parsed = await readJsonBody(request, tournamentCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ tournament: await createTournament(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return errorResponse("tournament-create", error);
  }
}
