import { NextResponse } from "next/server";
import { loadCollection, requireUser } from "@/lib/catalog";
import { saveCollectionLine } from "@/lib/collection-mutate";
import { readJsonBody, saveLineSchema } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const items = await loadCollection(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, saveLineSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await saveCollectionLine(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(request, "collection-save", error, "common.saveFailed");
  }
}
