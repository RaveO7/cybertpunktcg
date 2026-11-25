import { afterAll, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma";

type Counter = { count: number; resetAt: Date };

/**
 * Les routes register/login créent ou incrémentent des compteurs RateLimit (clé « portée:local » sans proxy).
 * À la fin, on supprime ceux que le fichier de test a créés et on remet les compteurs existants dans leur
 * état d'avant : sinon des passages rapprochés (script de mutations) cumulent leurs essais sur la même
 * fenêtre et finissent bloqués par la limite, sans rapport avec ce qui est testé.
 */
export function cleanupCreatedRateLimits() {
  let existing: Map<string, Counter> | null = null;
  beforeAll(async () => {
    const rows = await prisma.rateLimit.findMany({ select: { key: true, count: true, resetAt: true } });
    existing = new Map(rows.map(({ key, ...counter }) => [key, counter]));
  });
  afterAll(async () => {
    if (!existing) return;
    const known = existing;
    const rows = await prisma.rateLimit.findMany({ select: { key: true, count: true, resetAt: true } });
    const created = rows.filter((row) => !known.has(row.key)).map((row) => row.key);
    if (created.length) await prisma.rateLimit.deleteMany({ where: { key: { in: created } } });
    const changed = rows.flatMap((row) => {
      const before = known.get(row.key);
      return before && (before.count !== row.count || before.resetAt.getTime() !== row.resetAt.getTime())
        ? [{ key: row.key, ...before }]
        : [];
    });
    for (const { key, count, resetAt } of changed) {
      await prisma.rateLimit.update({ where: { key }, data: { count, resetAt } });
    }
  });
}
