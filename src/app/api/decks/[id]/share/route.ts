import { NextResponse } from "next/server";
import { readJsonBody, shareSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { createOrRotateDeckShare, deckShareInfo, getDeckShare, ownsDeck, revokeDeckShare } from "@/lib/deck-share";
import { apiError, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Compte connecté propriétaire du deck ; sinon la réponse à renvoyer (deck d'autrui : 404). */
async function ownerOf(request: Request, context: Context): Promise<{ response: Promise<Response> } | { deckId: string }> {
  const user = await requireUser(request);
  if (!user) return { response: sessionRequired(request) };
  const { id } = await context.params;
  if (!(await ownsDeck(user.id, id))) return { response: apiError(request, "decks.notFound", 404) };
  return { deckId: id };
}

export async function GET(request: Request, context: Context) {
  const owner = await ownerOf(request, context);
  if ("response" in owner) return owner.response;
  return NextResponse.json(deckShareInfo(request, await getDeckShare(owner.deckId)));
}

export async function POST(request: Request, context: Context) {
  const owner = await ownerOf(request, context);
  if ("response" in owner) return owner.response;
  const parsed = await readJsonBody(request, shareSchema);
  if (!parsed.ok) return parsed.response;
  const share = await createOrRotateDeckShare(owner.deckId, parsed.data?.rotate === true);
  return NextResponse.json(deckShareInfo(request, share));
}

export async function DELETE(request: Request, context: Context) {
  const owner = await ownerOf(request, context);
  if ("response" in owner) return owner.response;
  await revokeDeckShare(owner.deckId);
  return NextResponse.json({ active: false });
}
