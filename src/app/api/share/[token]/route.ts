import { NextResponse } from "next/server";
import { shareTokenSchema } from "@/lib/api-schemas";
import { loadSharedBinder } from "@/lib/share";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!shareTokenSchema.safeParse(token).success) {
    return apiError(request, "common.invalidLink", 400);
  }
  const binder = await loadSharedBinder(token);
  if (!binder) return apiError(request, "share.notFound", 404);
  return NextResponse.json(binder);
}
