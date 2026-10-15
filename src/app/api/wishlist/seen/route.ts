import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { acknowledgeWishlistAlerts } from "@/lib/wishlist";
import { sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Marque les alertes de prix du compte comme vues. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  await acknowledgeWishlistAlerts(user.id);
  return NextResponse.json({ ok: true });
}
