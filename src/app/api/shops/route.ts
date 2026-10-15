import { NextResponse } from "next/server";
import { readJsonBody, shopCreateSchema, shopDirectoryQuerySchema, validateSearchParams, validationError } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { createShop, listPublicShops } from "@/lib/shops/shops";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

/** Annuaire public des boutiques (non refusées), vérifiées d'abord. */
export async function GET(request: Request) {
  const parsed = validateSearchParams(shopDirectoryQuerySchema, new URL(request.url).searchParams);
  if (!parsed.ok) return validationError(request, parsed.failure);
  return NextResponse.json(await listPublicShops(parsed.data));
}

/** Création d'un profil boutique (en attente de vérification). */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, shopCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ shop: await createShop(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return errorResponse(request, "shop-create", error);
  }
}
