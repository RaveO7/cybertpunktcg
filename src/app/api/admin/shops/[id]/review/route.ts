import { NextResponse } from "next/server";
import { readJsonBody, shopReviewSchema } from "@/lib/api-schemas";
import { requireAdmin } from "@/lib/catalog";
import { reviewShop } from "@/lib/shops/shops";
import { errorResponse } from "@/lib/tournament/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Valider, refuser (motif obligatoire) ou retirer la vérification d'une boutique. */
export async function POST(request: Request, context: Context) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const parsed = await readJsonBody(request, shopReviewSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const shop = await reviewShop((await context.params).id, admin.id, parsed.data.decision, parsed.data.note);
    return NextResponse.json({ shop });
  } catch (error) {
    return errorResponse("shop-review", error);
  }
}
