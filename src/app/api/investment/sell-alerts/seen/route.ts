import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { acknowledgeSellAlerts } from "@/lib/sell-alerts";
import { sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Marque les alertes de revente du compte comme vues. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  await acknowledgeSellAlerts(user.id);
  return NextResponse.json({ ok: true });
}
