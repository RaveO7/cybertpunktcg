import { NextResponse } from "next/server";
import { readJsonBody, wishlistSaveSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { loadWishlist, saveWishlistItem } from "@/lib/wishlist";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  return NextResponse.json({ items: await loadWishlist(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, wishlistSaveSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ item: await saveWishlistItem(user.id, parsed.data) });
  } catch (error) {
    return errorResponse(request, "wishlist-save", error, "common.saveFailed");
  }
}
