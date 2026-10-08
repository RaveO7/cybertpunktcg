import { prisma } from "./prisma";
import { reportError } from "./monitoring";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterMs: number };

/**
 * Limiteur à fenêtre fixe stocké en base : le compteur est partagé entre toutes les
 * instances Vercel. En cas de panne de la base, on laisse passer (la route échouera de
 * toute façon sur sa propre requête) plutôt que de bloquer tout le monde.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  try {
    // Upsert natif (INSERT … ON CONFLICT) : incrément atomique même sous requêtes concurrentes.
    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: { increment: 1 } },
    });
    if (row.resetAt <= now) {
      // Fenêtre expirée : on repart à 1. La condition évite d'écraser une remise à zéro concurrente.
      await prisma.rateLimit.updateMany({
        where: { key, resetAt: { lte: now } },
        data: { count: 1, resetAt },
      });
      return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    if (row.count > limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, row.resetAt.getTime() - now.getTime()) };
    }
    return { ok: true, remaining: limit - row.count, retryAfterMs: 0 };
  } catch (error) {
    await reportError("rate-limit", error);
    return { ok: true, remaining: limit, retryAfterMs: 0 };
  }
}

/** Purge les compteurs expirés (appelé par le cron quotidien). */
export async function purgeExpiredRateLimits() {
  const { count } = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}

/** Les en-têtes d'IP ne sont fiables que derrière un proxy qui les réécrit (Vercel le fait). */
function trustProxy() {
  return process.env.TRUST_PROXY === "1" || process.env.VERCEL === "1";
}

let warnedMissingIp = false;

export function clientIp(request: Request) {
  if (!trustProxy()) return null;
  const headers = request.headers;
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

export function clientKey(request: Request, scope: string) {
  const ip = clientIp(request);
  if (!ip && process.env.NODE_ENV === "production" && !warnedMissingIp) {
    // Sans IP, tous les visiteurs partagent la même clé : quelques échecs bloqueraient tout le monde.
    warnedMissingIp = true;
    console.warn("rate-limit : IP client introuvable, clé commune « local » (définir TRUST_PROXY=1 derrière un proxy).");
  }
  return `${scope}:${ip || "local"}`;
}
