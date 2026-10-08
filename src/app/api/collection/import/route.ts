import { NextResponse } from "next/server";
import { loadCollection, requireUser } from "@/lib/catalog";
import { importCollectionLines } from "@/lib/collection-mutate";
import { importSchema, readJsonBody } from "@/lib/api-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const parsed = await readJsonBody(request, importSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const summary = await importCollectionLines(user.id, parsed.data);
    const items = await loadCollection(user.id);
    return NextResponse.json({ ...summary, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
