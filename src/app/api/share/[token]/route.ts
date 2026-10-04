import { NextResponse } from "next/server";
import { loadSharedBinder } from "@/lib/share";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }
  const binder = await loadSharedBinder(token);
  if (!binder) return NextResponse.json({ error: "Lien introuvable ou révoqué." }, { status: 404 });
  return NextResponse.json(binder);
}
