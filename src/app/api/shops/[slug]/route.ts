import { NextResponse } from "next/server";
import { readJsonBody, shopUpdateSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { deleteShop, getOwnedShop, listAttachedTournaments, updateShop } from "@/lib/shops/shops";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/** Boutique à modifier (gérant ou administrateur). La page publique est /boutiques/[slug]. */
export async function GET(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  try {
    const shop = await getOwnedShop((await context.params).slug, user);
    return NextResponse.json({ shop, tournaments: await listAttachedTournaments(shop.id) });
  } catch (error) {
    return errorResponse(request, "shop-get", error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, shopUpdateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ shop: await updateShop((await context.params).slug, user, parsed.data) });
  } catch (error) {
    return errorResponse(request, "shop-update", error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  try {
    await deleteShop((await context.params).slug, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(request, "shop-delete", error);
  }
}
