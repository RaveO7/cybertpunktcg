import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { saveCollectionBatch } from "@/lib/collection-mutate";
import { bulkSchema, readJsonBody } from "@/lib/api-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const parsed = await readJsonBody(request, bulkSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const items = await saveCollectionBatch(user.id, parsed.data);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ajout impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
