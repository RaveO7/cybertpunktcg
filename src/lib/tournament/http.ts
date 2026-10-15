// Réponses HTTP communes aux routes de tournoi.

import { apiError } from "@/lib/api-response";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export { errorResponse, sessionRequired } from "@/lib/api-response";

/** 20 essais par minute et par IP : saisie de code, inscription, récupération de profil. */
export async function limitCodeAttempts(request: Request, scope: string) {
  const limited = await rateLimit(clientKey(request, scope), 20, 60_000);
  if (limited.ok) return null;
  return apiError(request, "common.tooManyAttempts", 429, {
    headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) },
  });
}
