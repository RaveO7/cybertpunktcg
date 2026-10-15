import { NextResponse } from "next/server";
import {
  applyOAuthStateCookie,
  buildAuthorizationUrl,
  createOAuthState,
  isOAuthProvider,
  oauthConfigured,
} from "@/lib/oauth";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: Context) {
  const { provider: raw } = await context.params;
  if (!isOAuthProvider(raw)) {
    return apiError(request, "auth.unknownProvider", 404);
  }
  if (!oauthConfigured(raw)) {
    return apiError(request, "auth.providerNotConfigured", 503, { values: { provider: raw === "google" ? "Google" : "Apple" } });
  }

  const url = new URL(request.url);
  const localUserId = url.searchParams.get("localUserId");
  let state: string;
  try {
    state = createOAuthState(raw, localUserId);
  } catch {
    return apiError(request, "auth.oauthIncomplete", 503);
  }
  const response = NextResponse.redirect(buildAuthorizationUrl(raw, request, state));
  applyOAuthStateCookie(response, request, state);
  return response;
}
