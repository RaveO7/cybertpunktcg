import { NextResponse } from "next/server";
import { applySessionCookie, clearSessionCookie, refreshSession, toPublicUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await refreshSession(request);
  if (!session) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    clearSessionCookie(response, request);
    return response;
  }
  const response = NextResponse.json({ user: toPublicUser(session.user) });
  applySessionCookie(response, request, session.token, session.expiresAt);
  return response;
}
