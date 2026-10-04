import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  createOAuthState,
  isOAuthProvider,
  oauthConfigured,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: Context) {
  const { provider: raw } = await context.params;
  if (!isOAuthProvider(raw)) {
    return NextResponse.json({ error: "Fournisseur inconnu." }, { status: 404 });
  }
  if (!oauthConfigured(raw)) {
    return NextResponse.json(
      { error: `Connexion ${raw === "google" ? "Google" : "Apple"} non configurée.` },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const localUserId = url.searchParams.get("localUserId");
  let state: string;
  try {
    state = createOAuthState(raw, localUserId);
  } catch {
    return NextResponse.json(
      { error: "Configuration OAuth incomplète (secret de state manquant)." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(buildAuthorizationUrl(raw, request, state));
}
