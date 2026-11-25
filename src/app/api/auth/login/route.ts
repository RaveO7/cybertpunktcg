import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { loginSchema, validate, validationError } from "@/lib/api-schemas";
import { applySessionCookie, authenticate, createSession, toPublicUser } from "@/lib/auth";
import { blockedMs, clientKey, rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** 10 échecs par adresse e-mail et par 15 minutes. */
const EMAIL_FAILURE_LIMIT = 10;
const EMAIL_FAILURE_WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request, "login"), 20, 60_000);
  if (!limited.ok) {
    return apiError(request, "common.tooManyAttempts", 429, {
      headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) },
    });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body) return apiError(request, "common.invalidRequest", 400);
  // Identifiants mal formés : même réponse qu'un mauvais mot de passe.
  const parsed = validate(loginSchema, body, 401);
  if (!parsed.ok) return validationError(request, parsed.failure);
  const { email, password } = parsed.data;

  // Limite par compte visé, en plus de celle par IP : des IP changeantes ne contournent pas la devinette
  // de mot de passe. Seuls les échecs comptent (une connexion réussie ne consomme rien), et la clé ne
  // dépend pas de l'IP : l'absence d'IP (« local ») ne bloque personne à tort.
  const failureKey = `login-fail:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
  const blocked = await blockedMs(failureKey, EMAIL_FAILURE_LIMIT);
  if (blocked > 0) {
    return apiError(request, "common.tooManyAttempts", 429, {
      headers: { "retry-after": String(Math.ceil(blocked / 1000)) },
    });
  }

  const user = await authenticate(email, password);
  if (!user) {
    await rateLimit(failureKey, EMAIL_FAILURE_LIMIT, EMAIL_FAILURE_WINDOW_MS);
    return apiError(request, "auth.invalidCredentials", 401);
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  applySessionCookie(response, request, session.token, session.expiresAt);
  return response;
}
