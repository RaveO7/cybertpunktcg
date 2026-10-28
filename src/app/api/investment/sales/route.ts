import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { loadSales, sellCollectionLine } from "@/lib/sales";
import { readJsonBody, saleCreateSchema } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Ventes du compte, de la plus récente à la plus ancienne. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  return NextResponse.json({ sales: await loadSales(user.id) });
}

/** Vend des exemplaires d'une ligne : renvoie la vente et la ligne mise à jour (ou supprimée). */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, saleCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await sellCollectionLine(user.id, parsed.data));
  } catch (error) {
    return errorResponse(request, "investment-sell", error, "common.saveFailed");
  }
}
