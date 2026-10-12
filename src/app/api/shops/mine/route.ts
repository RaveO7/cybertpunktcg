import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { listOwnedShops } from "@/lib/shops/shops";
import { sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

/** Boutiques gérées par le compte connecté (avec leur état de vérification). */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  return NextResponse.json({ shops: await listOwnedShops(user.id), isAdmin: user.role === "admin" });
}
