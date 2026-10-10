import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { acknowledgeWishlistAlerts } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

/** Marque les alertes de prix du compte comme vues. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  await acknowledgeWishlistAlerts(user.id);
  return NextResponse.json({ ok: true });
}
