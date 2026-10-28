import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { loadSellAlerts, saveSellAlert } from "@/lib/sell-alerts";
import { readJsonBody, sellAlertSaveSchema } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Alertes de revente du compte. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  return NextResponse.json({ alerts: await loadSellAlerts(user.id) });
}

/** Pose ou remplace le prix de revente visé d'une carte possédée. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, sellAlertSaveSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ alert: await saveSellAlert(user.id, parsed.data) });
  } catch (error) {
    return errorResponse(request, "sell-alert-save", error, "common.saveFailed");
  }
}
