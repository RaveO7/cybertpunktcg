import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { detachTournament } from "@/lib/shops/shops";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string; id: string }> };

/** Le gérant retire un tournoi de sa boutique (le tournoi lui-même n'est pas touché). */
export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  const { slug, id } = await context.params;
  try {
    await detachTournament(slug, id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse("shop-detach", error);
  }
}
