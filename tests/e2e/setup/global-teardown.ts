import { prisma } from "@/lib/prisma";
import { requireLocalDatabase } from "./local-db";
import { requireRunId, runClientIp, runEmailPrefix } from "./paths";

/**
 * Filet de sécurité : supprime les comptes et les compteurs du limiteur créés par ce run, même si un
 * test a été interrompu avant son propre nettoyage. Le filtre porte sur l'identifiant du run : il ne
 * peut atteindre ni un compte réel ni un autre run.
 *
 * Run entier tué avant ce nettoyage : supprimer à la main les restes de tous les runs (SQLite local) :
 *   DELETE FROM "User" WHERE email LIKE 'e2e.%@example.com';
 *   DELETE FROM "RateLimit" WHERE key LIKE '%:e2e-%';
 */
export default async function globalTeardown() {
  requireLocalDatabase();
  const runId = requireRunId();
  try {
    const users = await prisma.user.deleteMany({
      where: { email: { startsWith: runEmailPrefix(runId), endsWith: "@example.com" } },
    });
    const limits = await prisma.rateLimit.deleteMany({
      where: { key: { endsWith: `:${runClientIp(runId)}` } },
    });
    if (users.count || limits.count) {
      console.log(`e2e : nettoyage final, ${users.count} compte(s) et ${limits.count} compteur(s) supprimés.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
