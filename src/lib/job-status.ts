import { prisma } from "./prisma";
import { reportError, sendAlert } from "./monitoring";

const STALE_GUIDE_DAYS = 3;

/** Enregistre un succès. Prévient si la tâche se rétablit après des échecs. */
export async function recordJobSuccess(name: string) {
  const now = new Date();
  const previous = await prisma.jobStatus.findUnique({ where: { name } });
  await prisma.jobStatus.upsert({
    where: { name },
    create: { name, lastRunAt: now, lastSuccessAt: now, consecutiveFailures: 0 },
    update: { lastRunAt: now, lastSuccessAt: now, lastError: null, consecutiveFailures: 0 },
  });
  if (previous && previous.consecutiveFailures > 0) {
    await sendAlert(`${name} rétabli après ${previous.consecutiveFailures} échec(s).`);
  }
}

/** Enregistre un échec et alerte avec le nombre d'échecs consécutifs. */
export async function recordJobFailure(name: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  let failures = 1;
  let lastSuccessAt: Date | null = null;
  try {
    const row = await prisma.jobStatus.upsert({
      where: { name },
      create: { name, lastRunAt: new Date(), lastError: message, consecutiveFailures: 1 },
      update: { lastRunAt: new Date(), lastError: message, consecutiveFailures: { increment: 1 } },
    });
    failures = row.consecutiveFailures;
    lastSuccessAt = row.lastSuccessAt;
  } catch (dbError) {
    // La base elle-même peut être la cause : on alerte quand même.
    console.error(`Statut de ${name} non enregistré : ${dbError instanceof Error ? dbError.message : dbError}`);
  }
  const since = lastSuccessAt ? ` Dernier succès : ${lastSuccessAt.toISOString()}.` : "";
  await reportError(name, error, { consecutiveFailures: failures });
  if (failures > 1) await sendAlert(`${name} : ${failures} échecs consécutifs.${since}`);
}

/** Alerte si le dernier guide de prix Cardmarket importé est trop ancien. */
export async function checkPriceGuideFreshness() {
  const source = await prisma.priceSource.findUnique({
    where: { code: "cardmarket" },
    select: { guideCreatedAt: true },
  });
  const guideDate = source?.guideCreatedAt;
  if (!guideDate) return null;
  const ageDays = Math.floor((Date.now() - guideDate.getTime()) / 86_400_000);
  if (ageDays >= STALE_GUIDE_DAYS) {
    await sendAlert(`Prix Cardmarket non mis à jour depuis ${ageDays} jours (guide du ${guideDate.toISOString().slice(0, 10)}).`);
  }
  return ageDays;
}
