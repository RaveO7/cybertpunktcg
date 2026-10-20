import { NextResponse } from "next/server";
import { readJsonBody, wishlistBulkSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { addWishlistItems } from "@/lib/wishlist";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Ajoute plusieurs tirages à la liste de souhaits (cartes manquantes d'un deck), tout ou rien. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, wishlistBulkSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await addWishlistItems(user.id, parsed.data.printingIds));
  } catch (error) {
    return errorResponse(request, "wishlist-bulk", error, "common.saveFailed");
  }
}
