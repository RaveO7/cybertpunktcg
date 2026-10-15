import { NextResponse } from "next/server";
import { deckCreateSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { createDeck, loadDecks } from "@/lib/decks";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  return NextResponse.json({ decks: await loadDecks(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, deckCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ deck: await createDeck(user.id, parsed.data) });
  } catch (error) {
    return errorResponse(request, "deck-create", error, "common.createFailed");
  }
}
