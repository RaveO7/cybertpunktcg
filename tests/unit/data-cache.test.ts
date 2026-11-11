/**
 * Cache des écrans : requêtes identiques regroupées, réponse partie avant un vidage (changement de
 * session) ou une modification locale jamais remise en cache, réponse invalide jamais mise en cache.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { clearDataCache, fetchCached, readCached, writeCached } from "../../src/components/data-cache";
import { ApiError } from "../../src/lib/client/api";

// Réponse la plus simple parmi les schémas : `{ code }`.
const schema = "tournamentCodeSchema";

/** `fetch` simulé dont on choisit le moment de la réponse. */
function deferredFetch() {
  const pending: ((body: unknown) => void)[] = [];
  const fetchMock = vi.fn(
    () => new Promise<Response>((resolve) => pending.push((body) => resolve(new Response(JSON.stringify(body), { status: 200 })))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, respond: (body: unknown) => pending.shift()?.(body) };
}

afterEach(() => {
  clearDataCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchCached", () => {
  it("deux appels simultanés : un seul envoi, même résultat, mis en cache", async () => {
    const { fetchMock, respond } = deferredFetch();
    const first = fetchCached("/api/x", { schema });
    const second = fetchCached("/api/x", { schema });
    respond({ code: "1" });
    assert.deepEqual(await Promise.all([first, second]), [{ code: "1" }, { code: "1" }]);
    assert.equal(fetchMock.mock.calls.length, 1);
    assert.deepEqual(readCached("/api/x"), { code: "1" });
  });

  it("corps différent : requête et entrée distinctes", async () => {
    const { fetchMock, respond } = deferredFetch();
    const a = fetchCached("/api/x", { schema, body: { items: ["a"] } });
    const b = fetchCached("/api/x", { schema, body: { items: ["b"] } });
    respond({ code: "1" });
    respond({ code: "2" });
    await Promise.all([a, b]);
    assert.equal(fetchMock.mock.calls.length, 2);
    assert.deepEqual(readCached("/api/x", { items: ["b"] }), { code: "2" });
    assert.equal(readCached("/api/x"), undefined);
  });

  it("réponse arrivée après un vidage (autre session) : rendue, mais pas mise en cache", async () => {
    const { respond } = deferredFetch();
    const request = fetchCached("/api/x", { schema });
    clearDataCache();
    respond({ code: "1" });
    await request;
    assert.equal(readCached("/api/x"), undefined);
  });

  it("réponse arrivée après une modification locale : ne l'écrase pas", async () => {
    const { respond } = deferredFetch();
    const request = fetchCached("/api/x", { schema });
    writeCached("/api/x", { code: "5" });
    respond({ code: "1" });
    await request;
    assert.deepEqual(readCached("/api/x"), { code: "5" });
  });

  it("réponse au format inattendu : ApiError invalid, rien en cache", async () => {
    const { respond } = deferredFetch();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = fetchCached("/api/x", { schema });
    respond({ code: 1 });
    await assert.rejects(request, (error: unknown) => error instanceof ApiError && error.kind === "invalid");
    assert.equal(readCached("/api/x"), undefined);
  });
});
