import { NextResponse } from "next/server";
import {
  applySessionCookie,
  authenticate,
  createSession,
  normalizeEmail,
  normalizeLoginPassword,
  toPublicUser,
} from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "login"), 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) } },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const email = normalizeEmail(body.email);
  const password = normalizeLoginPassword(body.password);
  if (!email || !password) {
    return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
  }

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  applySessionCookie(response, request, session.token, session.expiresAt);
  return response;
}
