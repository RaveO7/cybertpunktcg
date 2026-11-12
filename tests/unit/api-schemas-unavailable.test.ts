/**
 * Schémas des réponses impossibles à charger (réseau coupé avant l'arrivée de leur fichier) : une réponse
 * reçue n'est jamais acceptée sans vérification. `fetch` simulé.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { ApiError, api } from "../../src/lib/client/api";
import { addOp, memoryQueueStore, replayQueue } from "../../src/lib/offline-queue";

vi.mock("../../src/lib/api-responses", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("schémas indisponibles", () => {
  it("api() : réponse reçue mais invérifiable → kind invalid (jamais offline : une écriture serait renvoyée)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "A" }), { status: 200 })));
    await assert.rejects(
      api("/api/x", { schema: "tournamentCodeSchema" }),
      (error: unknown) => error instanceof ApiError && error.kind === "invalid" && error.status === 200,
    );
  });

  it("file hors ligne : rien n'est envoyé, la file reste pour plus tard", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", { kind: "delete", lineId: "line-1", payload: null });
    const send = vi.fn();
    const report = await replayQueue(store, "u1", send);
    assert.equal(send.mock.calls.length, 0);
    assert.equal(report.stop, "retry");
    assert.equal(report.remaining.length, 1);
  });
});
