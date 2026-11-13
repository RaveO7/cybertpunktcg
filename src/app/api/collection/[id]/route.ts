import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { deleteCollectionLine, patchCollectionLine } from "@/lib/collection-mutate";
import { patchLineSchema, readJsonBody } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  const parsed = await readJsonBody(request, patchLineSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await patchCollectionLine(user.id, id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(request, "collection-update", error, "common.updateFailed");
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  try {
    const result = await deleteCollectionLine(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(request, "collection-delete", error, "common.updateFailed");
  }
}
