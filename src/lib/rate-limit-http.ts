// Limite de débit des écritures d'un compte connecté : réponse 429 prête à renvoyer.
import { apiError } from "./api-response";
import { rateLimit } from "./rate-limit";

/** Compte les appels du compte (pas de l'IP : partagée derrière un NAT). `null` tant que la limite n'est pas atteinte. */
export async function limitUserWrites(request: Request, scope: string, userId: string, limit: number, windowMs: number) {
  const limited = await rateLimit(`${scope}:user:${userId}`, limit, windowMs);
  if (limited.ok) return null;
  return apiError(request, "common.tooManyAttempts", 429, {
    headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) },
  });
}
