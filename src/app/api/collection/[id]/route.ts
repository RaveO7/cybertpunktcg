import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { deleteCollectionLine, patchCollectionLine } from "@/lib/collection-mutate";
import { parseCurrency, parseNotes, parsePrice, parseQuantity } from "@/lib/parse";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const quantity = body.quantity === undefined ? undefined : parseQuantity(body.quantity);
  if (body.quantity !== undefined && quantity == null) {
    return NextResponse.json({ error: "Quantité invalide." }, { status: 400 });
  }
  const purchasePrice = parsePrice(body.purchasePrice);
  try {
    const result = await patchCollectionLine(user.id, id, {
      conditionCode: typeof body.conditionCode === "string" ? body.conditionCode : undefined,
      quantity: quantity ?? undefined,
      notes: parseNotes(body.notes),
      purchasePrice,
      purchaseCurrency: parseCurrency(body.purchaseCurrency, purchasePrice),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise à jour impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { id } = await context.params;
  const result = await deleteCollectionLine(user.id, id);
  return NextResponse.json(result);
}
