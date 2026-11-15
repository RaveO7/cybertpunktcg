import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { clientErrorSchema, readJsonBody } from "@/lib/api-schemas";
import { reportError } from "@/lib/monitoring";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Erreurs JavaScript des visiteurs (erreurs d'hydratation de React comprises), journalisées comme les
 * erreurs serveur (logs Vercel, alerte). Ouverte sans session : limitée par IP.
 */
export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request, "client-error"), 20, 10 * 60_000);
  if (!limited.ok) return apiError(request, "common.tooManyAttempts", 429);
  const parsed = await readJsonBody(request, clientErrorSchema);
  if (!parsed.ok) return parsed.response;
  const { message, ...context } = parsed.data;
  await reportError("client", message, { ...context, userAgent: request.headers.get("user-agent")?.slice(0, 300) });
  return new NextResponse(null, { status: 204 });
}
