import { NextResponse } from "next/server";
import { loadCollection, requireUser } from "@/lib/catalog";
import { importCollectionLines } from "@/lib/collection-mutate";
import { importSchema, readJsonBody } from "@/lib/api-schemas";
import { limitUserWrites } from "@/lib/rate-limit-http";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const limited = await limitUserWrites(request, "collection-import", user.id, 10, 10 * 60_000);
  if (limited) return limited;
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
