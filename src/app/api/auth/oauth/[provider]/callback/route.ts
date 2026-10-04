import { NextResponse } from "next/server";
import { applySessionCookie, createSession } from "@/lib/auth";
import {
  appOrigin,
  exchangeOAuthCode,
  isOAuthProvider,
  loginWithOAuth,
  oauthConfigured,
  oauthErrorRedirect,
  verifyOAuthState,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ provider: string }> };

async function finish(
  request: Request,
  providerRaw: string,
  params: { code: string | null; state: string | null; error: string | null; appleUser: string | null },
) {
  const origin = appOrigin(request);
  const fail = (message: string) => NextResponse.redirect(oauthErrorRedirect(origin, message));

  if (!isOAuthProvider(providerRaw)) return fail("Fournisseur de connexion inconnu.");
  if (!oauthConfigured(providerRaw)) {
    return fail(`Connexion ${providerRaw === "google" ? "Google" : "Apple"} non configurée.`);
  }
  if (params.error) return fail("Connexion annulée.");
  if (!params.code || !params.state) return fail("Réponse OAuth invalide.");

  const stored = verifyOAuthState(params.state, providerRaw);
  if (!stored) return fail("Session OAuth expirée. Réessayez.");

  try {
    const profile = await exchangeOAuthCode(providerRaw, params.code, request, params.appleUser);
    const user = await loginWithOAuth(profile, stored.localUserId);
    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", origin));
    applySessionCookie(response, request, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "OAUTH_EMAIL_REQUIRED") {
      return fail("L'adresse e-mail est requise pour créer un compte.");
    }
    if (error instanceof Error && (error.message === "ACCOUNT_EXISTS" || error.message === "EMAIL_TAKEN")) {
      return fail("Un compte existe déjà avec cet e-mail. Connectez-vous avec votre mot de passe.");
    }
    return fail("Connexion impossible. Réessayez.");
  }
}

export async function GET(request: Request, context: Context) {
  const { provider } = await context.params;
  const url = new URL(request.url);
  return finish(request, provider, {
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
    return finish(request, provider, { code: null, state: null, error: "invalid", appleUser: null });
  }
  const asString = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : null;
  };
  return finish(request, provider, {
    code: asString("code"),
    state: asString("state"),
    error: asString("error"),
    appleUser: asString("user"),
  });
}
