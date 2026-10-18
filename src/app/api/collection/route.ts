import { NextResponse } from "next/server";
import { applySessionCookie, clearSessionCookie, refreshSession, toPublicUser } from "@/lib/auth";
import { loadCollection, requireUser } from "@/lib/catalog";
import { saveCollectionLine } from "@/lib/collection-mutate";
import { readJsonBody, saveLineSchema } from "@/lib/api-schemas";
import { errorResponse, sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Collection du compte, avec le compte lui-même : au démarrage, cette seule requête vérifie et prolonge
 * la session (comme /api/auth/session) et apporte les données, au lieu de deux allers-retours.
 */
export async function GET(request: Request) {
  const session = await refreshSession(request);
  if (!session) {
    const response = await sessionRequired(request);
    clearSessionCookie(response, request);
    return response;
  }
  const items = await loadCollection(session.user.id);
  const response = NextResponse.json({ user: toPublicUser(session.user), items });
  applySessionCookie(response, request, session.token, session.expiresAt);
  return response;
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, saveLineSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await saveCollectionLine(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(request, "collection-save", error, "common.saveFailed");
  }
}
