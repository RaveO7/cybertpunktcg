import { NextResponse } from "next/server";
import { deckCreateSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { createDeck, loadDecks } from "@/lib/decks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  return NextResponse.json({ decks: await loadDecks(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const parsed = await readJsonBody(request, deckCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ deck: await createDeck(user.id, parsed.data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
