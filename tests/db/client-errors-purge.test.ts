/**
 * Purge des erreurs des visiteurs de plus de 30 jours (cron quotidien). Travaille sur une COPIE de la base
 * SQLite : la purge supprime toutes les lignes anciennes, pas seulement celles du test.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type ClientErrors = typeof import("../../src/lib/client-errors");

let prisma: Prisma;
let clientErrors: ClientErrors;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ prisma, cleanup } = await openDatabaseCopy("client-errors-"));
  clientErrors = await import("../../src/lib/client-errors");
});

afterAll(async () => {
  await cleanup();
});

describe("purgeOldClientErrors", () => {
  it("supprime les erreurs de plus de 30 jours et garde les autres", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const day = 24 * 60 * 60 * 1000;
    const base = { message: "Error: test", path: "/fr", serviceWorker: false };
    await prisma.clientError.deleteMany();
    await prisma.clientError.createMany({
      data: [
        { ...base, createdAt: new Date(now.getTime() - 31 * day) },
        { ...base, createdAt: new Date(now.getTime() - 29 * day) },
      ],
    });
    assert.equal(await clientErrors.purgeOldClientErrors(now), 1);
    const left = await prisma.clientError.findMany({ select: { createdAt: true } });
    assert.deepEqual(left, [{ createdAt: new Date(now.getTime() - 29 * day) }]);
  });
});
