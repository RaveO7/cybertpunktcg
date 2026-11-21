import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { hasBearerSecret } from "@/lib/bearer-secret";
import { CATALOG_CACHE_TAG } from "@/lib/catalog";

// Appelé par scripts/sync-local-to-prod.ts après l'envoi du catalogue en prod (« Authorization: Bearer
// $REVALIDATE_SECRET ») : sans lui, catalogue et fiches publiques restent jusqu'à une heure sur l'ancienne version.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasBearerSecret(request, process.env.REVALIDATE_SECRET)) return apiError(request, "common.unauthorized", 401);
  // expire 0 : la synchro vient de changer la base, la visite suivante doit déjà voir les nouvelles données.
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ revalidated: CATALOG_CACHE_TAG });
}
