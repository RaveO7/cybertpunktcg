import { afterAll, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma";

/**
 * Les routes register/login créent des compteurs RateLimit (clé « portée:local » sans proxy).
 * On supprime à la fin ceux que le fichier de test a créés, sans toucher aux compteurs existants.
 */
export function cleanupCreatedRateLimits() {
  let existing: Set<string> | null = null;
  beforeAll(async () => {
    existing = new Set((await prisma.rateLimit.findMany({ select: { key: true } })).map((row) => row.key));
  });
  afterAll(async () => {
    if (!existing) return;
    const known = existing;
    const rows = await prisma.rateLimit.findMany({ select: { key: true } });
    const created = rows.map((row) => row.key).filter((key) => !known.has(key));
    if (created.length) await prisma.rateLimit.deleteMany({ where: { key: { in: created } } });
  });
}
