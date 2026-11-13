import { NextResponse } from "next/server";
import { pushSubscribeSchema, pushUnsubscribeSchema, readJsonBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import { removePushSubscription, savePushSubscription } from "@/lib/push";
import { errorResponse, requestLocale, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Active les notifications d'alerte de prix sur cet appareil (abonnement Web Push du navigateur). */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, pushSubscribeSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await savePushSubscription(user.id, parsed.data, requestLocale(request)));
  } catch (error) {
    return errorResponse(request, "push-subscribe", error, "common.saveFailed");
  }
}

/** Désactive les notifications sur cet appareil (réglages, déconnexion). */
export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, pushUnsubscribeSchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(await removePushSubscription(user.id, parsed.data.endpoint));
}
