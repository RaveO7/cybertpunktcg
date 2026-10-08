import { NextResponse } from "next/server";
import { readJsonBody, registerSchema } from "@/lib/api-schemas";
import { applySessionCookie, createSession, registerAccount, toPublicUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request, "register"), 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Trop de créations de compte. Réessayez dans une minute." },
      { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) } },
    );
  }

  const parsed = await readJsonBody(request, registerSchema);
  if (!parsed.ok) return parsed.response;
  const { email, password, displayName } = parsed.data;
  const localUserId = parsed.data.localUserId ?? null;

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
