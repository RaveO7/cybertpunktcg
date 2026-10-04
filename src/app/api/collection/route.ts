import { NextResponse } from "next/server";
import { loadCollection, requireUser } from "@/lib/catalog";
import { saveCollectionLine } from "@/lib/collection-mutate";
import { parseCurrency, parseNotes, parsePrice, parseQuantity } from "@/lib/parse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const items = await loadCollection(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.printingId !== "string") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const quantity = parseQuantity(body.quantity);
  if (quantity == null) return NextResponse.json({ error: "Quantité invalide." }, { status: 400 });
  const conditionCode = typeof body.conditionCode === "string" ? body.conditionCode : "NM";
  const mode = body.mode === "set" ? "set" : "add";
  const purchasePrice = parsePrice(body.purchasePrice);
  try {
    const result = await saveCollectionLine(user.id, {
      printingId: body.printingId,
      conditionCode,
      quantity,
      mode,
      notes: parseNotes(body.notes),
      purchasePrice,
      purchaseCurrency: parseCurrency(body.purchaseCurrency, purchasePrice),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enregistrement impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
