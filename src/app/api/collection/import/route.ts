import { NextResponse } from "next/server";
import { loadCollection, requireUser } from "@/lib/catalog";
import { importCollectionLines } from "@/lib/collection-mutate";
import { importSchema, readJsonBody } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, importSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const summary = await importCollectionLines(user.id, parsed.data);
    const items = await loadCollection(user.id);
    return NextResponse.json({ ...summary, items });
  } catch (error) {
    return errorResponse(request, "collection-import", error, "common.importFailed");
  }
}
