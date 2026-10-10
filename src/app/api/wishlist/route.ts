import { NextResponse } from "next/server";
import { readJsonBody, wishlistSaveSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { loadWishlist, saveWishlistItem } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  return NextResponse.json({ items: await loadWishlist(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const parsed = await readJsonBody(request, wishlistSaveSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ item: await saveWishlistItem(user.id, parsed.data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enregistrement impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
