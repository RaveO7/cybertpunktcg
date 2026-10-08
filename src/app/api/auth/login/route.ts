import { NextResponse } from "next/server";
import { loginSchema, validate } from "@/lib/api-schemas";
import { applySessionCookie, authenticate, createSession, toPublicUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request, "login"), 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  // Identifiants mal formés : même réponse qu'un mauvais mot de passe.
  const parsed = validate(loginSchema, body, 401);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  applySessionCookie(response, request, session.token, session.expiresAt);
  return response;
}
