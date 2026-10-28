import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { deleteSellAlert } from "@/lib/sell-alerts";
import { sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const { id } = await context.params;
  return NextResponse.json(await deleteSellAlert(user.id, id));
}
