import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { clientErrorSchema, readJsonBody } from "@/lib/api-schemas";
import { recordClientError } from "@/lib/client-errors";
import { reportError } from "@/lib/monitoring";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Erreurs JavaScript des visiteurs (erreurs d'hydratation de React comprises), journalisées comme les
 * erreurs serveur (logs Vercel, alerte) et gardées en base 30 jours (scripts/client-errors.ts).
 * Ouverte sans session : limitée par IP.
 */
export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request, "client-error"), 20, 10 * 60_000);
  if (!limited.ok) return apiError(request, "common.tooManyAttempts", 429);
  const parsed = await readJsonBody(request, clientErrorSchema);
  if (!parsed.ok) return parsed.response;
  const { message, ...context } = parsed.data;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  await reportError("client", message, { ...context, userAgent });
  await recordClientError({ ...parsed.data, userAgent }).catch((error: unknown) => reportError("client-errors", error));
  return new NextResponse(null, { status: 204 });
}
