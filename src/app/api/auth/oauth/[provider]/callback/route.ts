import { NextResponse } from "next/server";
import { applySessionCookie, createSession } from "@/lib/auth";
import {
  appOrigin,
  clearOAuthStateCookie,
  exchangeOAuthCode,
  isOAuthProvider,
  loginWithOAuth,
  oauthConfigured,
  oauthErrorRedirect,
  oauthStateMatchesBrowser,
  verifyOAuthState,
  type OAuthErrorCode,
} from "@/lib/oauth";
import { requestLocale } from "@/lib/api-response";
import { formatRoute } from "@/i18n/match";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ provider: string }> };

async function finish(
  request: Request,
  providerRaw: string,
  params: { code: string | null; state: string | null; error: string | null; appleUser: string | null },
) {
  const origin = appOrigin(request);
  const fail = (code: OAuthErrorCode) => NextResponse.redirect(oauthErrorRedirect(origin, code, requestLocale(request)));

  if (!isOAuthProvider(providerRaw)) return fail("unknownProvider");
  if (!oauthConfigured(providerRaw)) return fail("notConfigured");
  if (params.error) return fail("cancelled");
  if (!params.code || !params.state) return fail("invalidResponse");

  const stored = verifyOAuthState(params.state, providerRaw);
  if (!stored || !oauthStateMatchesBrowser(request, params.state)) return fail("expired");

  try {
    const profile = await exchangeOAuthCode(providerRaw, params.code, request, params.appleUser);
    const user = await loginWithOAuth(profile, stored.localUserId);
    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL(formatRoute("/", requestLocale(request)), origin));
    applySessionCookie(response, request, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "OAUTH_EMAIL_REQUIRED") {
      return fail("emailRequired");
    }
    if (error instanceof Error && (error.message === "ACCOUNT_EXISTS" || error.message === "EMAIL_TAKEN")) {
      return fail("accountExists");
    }
    return fail("failed");
  }
}

/** Le state ne sert qu'une fois : le cookie est effacé quelle que soit l'issue. */
async function finishOnce(request: Request, ...args: [string, Parameters<typeof finish>[2]]) {
  const response = await finish(request, ...args);
  clearOAuthStateCookie(response, request);
  return response;
}

export async function GET(request: Request, context: Context) {
  const { provider } = await context.params;
  const url = new URL(request.url);
  return finishOnce(request, provider, {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    error: url.searchParams.get("error"),
    appleUser: null,
  });
}

export async function POST(request: Request, context: Context) {
  const { provider } = await context.params;
  const form = await request.formData().catch(() => null);
  if (!form) {
    return finishOnce(request, provider, { code: null, state: null, error: "invalid", appleUser: null });
  }
  const asString = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : null;
  };
  return finishOnce(request, provider, {
    code: asString("code"),
    state: asString("state"),
    error: asString("error"),
    appleUser: asString("user"),
  });
}
