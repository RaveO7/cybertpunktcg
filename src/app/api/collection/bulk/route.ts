import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { saveCollectionBatch } from "@/lib/collection-mutate";
import { bulkSchema, readJsonBody } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, bulkSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const items = await saveCollectionBatch(user.id, parsed.data);
    return NextResponse.json({ items });
  } catch (error) {
    return errorResponse(request, "collection-bulk", error, "common.addFailed");
  }
}
