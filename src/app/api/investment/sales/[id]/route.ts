import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { patchSale, undoSale } from "@/lib/sales";
import { readJsonBody, salePatchSchema } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Corrige le prix, la devise, les frais ou la date d'une vente. */
export async function PATCH(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  const parsed = await readJsonBody(request, salePatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ sale: await patchSale(user.id, id, parsed.data) });
  } catch (error) {
    return errorResponse(request, "investment-sale-update", error, "common.updateFailed");
  }
}

/** Annule une vente : ses exemplaires reviennent dans la collection. */
export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  try {
    return NextResponse.json(await undoSale(user.id, id));
  } catch (error) {
    return errorResponse(request, "investment-sale-undo", error, "common.updateFailed");
  }
}
