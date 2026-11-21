import type { z } from "zod";
import type { clientErrorSchema } from "./api-schemas";
import { prisma } from "./prisma";

// Assez pour comparer avant et après une correction, sans laisser la table grossir.
const RETENTION_DAYS = 30;

type ClientErrorReport = z.infer<typeof clientErrorSchema> & { userAgent: string | null };

/** Garde l'erreur d'un visiteur en base : les logs Vercel ne la conservent qu'une heure. */
export async function recordClientError(report: ClientErrorReport) {
  await prisma.clientError.create({ data: report });
}

/** Supprime les erreurs de plus de 30 jours (appelé par le cron quotidien). */
export async function purgeOldClientErrors(now = new Date()) {
  const { count } = await prisma.clientError.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
  });
  return count;
}
