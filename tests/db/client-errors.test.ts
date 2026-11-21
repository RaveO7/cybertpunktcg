/**
 * POST /api/client-errors : erreur du navigateur journalisée et gardée en base, corps invalide refusé, débit
 * limité par IP. Les erreurs et compteurs RateLimit créés par le fichier sont supprimés à la fin.
 */
import assert from "node:assert/strict";
import { afterAll, beforeEach, describe, it, vi } from "vitest";

const reportError = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/monitoring", async (original) => ({ ...(await original<typeof import("../../src/lib/monitoring")>()), reportError }));
import { POST } from "../../src/app/api/client-errors/route";
import { prisma } from "../../src/lib/prisma";
import { cleanupCreatedRateLimits } from "../helpers/rate-limit";

cleanupCreatedRateLimits();

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const previousTrustProxy = process.env.TRUST_PROXY;
afterAll(async () => {
  await prisma.clientError.deleteMany({ where: { message: { contains: stamp } } });
  if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previousTrustProxy;
});

function post(body: unknown, ip: string) {
  return POST(
    new Request("http://127.0.0.1/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip, "user-agent": "Test/1.0" },
      body: JSON.stringify(body),
    }),
  );
}

const report = { message: `Error: Minified React error #418 ${stamp}`, stack: "Error: x", path: "/fr/cartes", serviceWorker: false };

beforeEach(() => {
  reportError.mockClear();
  process.env.TRUST_PROXY = "1";
});

describe("POST /api/client-errors", () => {
  it("journalise l'erreur avec la page, le service worker et le navigateur, et la garde en base", async () => {
    const response = await post(report, `10.0.0.1-${stamp}`);
    assert.equal(response.status, 204);
    assert.deepEqual(reportError.mock.calls[0], [
      "client",
      report.message,
      { stack: report.stack, path: report.path, serviceWorker: false, userAgent: "Test/1.0" },
    ]);
    const saved = await prisma.clientError.findMany({
      where: { message: report.message },
      select: { message: true, stack: true, path: true, serviceWorker: true, userAgent: true },
    });
    assert.deepEqual(saved, [{ ...report, userAgent: "Test/1.0" }]);
  });

  it("refuse un corps invalide sans rien journaliser", async () => {
    const response = await post({ message: "", path: "/fr" }, `10.0.0.2-${stamp}`);
    assert.equal(response.status, 400);
    assert.equal(reportError.mock.calls.length, 0);
  });

  it("limite à 20 envois par IP sur 10 minutes", async () => {
    const ip = `10.0.0.3-${stamp}`;
    for (let i = 0; i < 20; i++) assert.equal((await post(report, ip)).status, 204);
    assert.equal((await post(report, ip)).status, 429);
    assert.equal(reportError.mock.calls.length, 20);
  });
});
