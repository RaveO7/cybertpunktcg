import { NextResponse } from "next/server";
import { deleteAccountSchema, readJsonBody } from "@/lib/api-schemas";
import { sessionRequired } from "@/lib/api-response";
import { clearSessionCookie, deleteAccount, userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Suppression du compte connecté et de toutes ses données (exigée par Google Play et le RGPD). */
export async function DELETE(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, deleteAccountSchema);
  if (!parsed.ok) return parsed.response;
  await deleteAccount(user.id);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request);
  return response;
}
