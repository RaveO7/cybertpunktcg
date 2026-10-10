import { NextResponse } from "next/server";
import { readJsonBody, wishlistPatchSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { deleteWishlistItem, patchWishlistItem } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { id } = await context.params;
  const parsed = await readJsonBody(request, wishlistPatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ item: await patchWishlistItem(user.id, id, parsed.data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise à jour impossible.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { id } = await context.params;
  return NextResponse.json(await deleteWishlistItem(user.id, id));
}
