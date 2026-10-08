import { NextResponse } from "next/server";
import { shareTokenSchema } from "@/lib/api-schemas";
import { loadSharedBinder } from "@/lib/share";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!shareTokenSchema.safeParse(token).success) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }
  const binder = await loadSharedBinder(token);
  if (!binder) return NextResponse.json({ error: "Lien introuvable ou révoqué." }, { status: 404 });
  return NextResponse.json(binder);
}
