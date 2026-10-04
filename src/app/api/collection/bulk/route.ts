import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { saveCollectionBatch } from "@/lib/collection-mutate";
import { parseQuantity } from "@/lib/parse";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    conditionCode?: unknown;
    lines?: unknown;
  } | null;
  if (!body || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (body.lines.length > 400) {
    return NextResponse.json({ error: "Trop de cartes d'un coup." }, { status: 400 });
  }
  const lines = body.lines.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const record = line as { printingId?: unknown; quantity?: unknown };
    if (typeof record.printingId !== "string") return [];
    const quantity = parseQuantity(record.quantity);
    if (quantity == null || quantity <= 0) return [];
    return [{ printingId: record.printingId, quantity }];
  });
  if (lines.length === 0) return NextResponse.json({ error: "Aucune carte à ajouter." }, { status: 400 });
  try {
    const items = await saveCollectionBatch(user.id, {
      conditionCode: typeof body.conditionCode === "string" ? body.conditionCode : "NM",
      lines,
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ajout impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
