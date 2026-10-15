import { NextResponse } from "next/server";
import { deckPatchSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { deleteDeck, updateDeck } from "@/lib/decks";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  const parsed = await readJsonBody(request, deckPatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ deck: await updateDeck(user.id, id, parsed.data) });
  } catch (error) {
    return errorResponse(request, "deck-update", error, "common.updateFailed");
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  return NextResponse.json(await deleteDeck(user.id, id));
}
