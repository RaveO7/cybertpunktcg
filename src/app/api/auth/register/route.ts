import { NextResponse } from "next/server";
import {
  applySessionCookie,
  createSession,
  normalizeDisplayName,
  normalizeEmail,
  normalizePassword,
  registerAccount,
  toPublicUser,
} from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "register"), 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Trop de créations de compte. Réessayez dans une minute." },
      { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) } },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  if (!email) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  if (!password) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  }

  const requestedName = typeof body.displayName === "string" ? body.displayName : "";
  const displayName = requestedName.trim() ? normalizeDisplayName(requestedName) : null;
  if (requestedName.trim() && !displayName) {
    return NextResponse.json({ error: "Le nom affiché doit contenir entre 1 et 40 caractères." }, { status: 400 });
  }

  const localUserId = typeof body.localUserId === "string" ? body.localUserId.trim() : null;

  try {
    const user = await registerAccount({ email, password, displayName, localUserId });
    const session = await createSession(user.id);
    const response = NextResponse.json({ user: toPublicUser(user) });
    applySessionCookie(response, request, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 });
    }
    return NextResponse.json({ error: "Création du compte impossible." }, { status: 400 });
  }
}
