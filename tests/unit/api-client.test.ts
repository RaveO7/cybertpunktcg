/**
 * Utilitaire client des appels à /api : classement des échecs (réseau, session, serveur, format inattendu),
 * vérification des réponses par schéma, annulation et encodage du corps. `fetch` est simulé.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { ApiError, api, apiErrorMessage } from "../../src/lib/client/api";

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ApiError, `ApiError attendue, reçu ${String(error)}`);
    return error;
  }
  assert.fail("la requête aurait dû échouer");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api()", () => {
  it("réponse valide : rendue vérifiée et typée", async () => {
    respond(200, { code: "ABC123", extra: true });
    const { code } = await api("/api/x", { schema: "tournamentCodeSchema" });
    assert.equal(code, "ABC123");
  });

  it("sans schéma : la réponse est rendue telle quelle", async () => {
    respond(200, { active: false });
    assert.deepEqual(await api("/api/x", { method: "DELETE" }), { active: false });
  });

  it("pas de réseau : kind offline, status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const error = await failure(api("/api/x"));
    assert.equal(error.kind, "offline");
    assert.equal(error.status, 0);
  });

  it("401 : kind session", async () => {
    respond(401, { error: "Session requise." });
    const error = await failure(api("/api/x", { body: {} }));
    assert.equal(error.kind, "session");
    assert.equal(error.status, 401);
  });

  it("erreur du serveur avec message et détails : conservés", async () => {
    respond(409, { error: "Tournoi complet.", details: { max: 8 } });
    const error = await failure(api("/api/x", { body: {} }));
    assert.equal(error.kind, "server");
    assert.equal(error.status, 409);
    assert.equal(error.message, "Tournoi complet.");
    assert.deepEqual(error.details, { max: 8 });
  });

  it("erreur du serveur sans corps lisible : message vide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 500 })));
    const error = await failure(api("/api/x"));
    assert.equal(error.kind, "server");
    assert.equal(error.message, "");
  });

  it("réponse au format inattendu : kind invalid, signalée sans planter", async () => {
    respond(200, { code: 42 });
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = await failure(api("/api/x", { schema: "tournamentCodeSchema" }));
    assert.equal(error.kind, "invalid");
    assert.equal(report.mock.calls.length, 1);
  });

  it("annulation : relancée telle quelle, ce n'est pas une ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("aborted", "AbortError"))));
    await assert.rejects(api("/api/x"), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  });

  it("corps : JSON par défaut (POST), fichier envoyé tel quel avec son type", async () => {
    const fetchMock = respond(200, {});
    await api("/api/x", { body: { a: 1 } });
    await api("/api/logo", { method: "PUT", body: new Blob(["png"], { type: "image/png" }) });
    const [jsonCall, fileCall] = fetchMock.mock.calls as unknown as [string, RequestInit][];
    assert.equal(jsonCall[1].method, "POST");
    assert.equal(jsonCall[1].body, '{"a":1}');
    assert.deepEqual(jsonCall[1].headers, { "content-type": "application/json" });
    assert.ok(fileCall[1].body instanceof Blob);
    assert.deepEqual(fileCall[1].headers, { "content-type": "image/png" });
  });

  it("message affiché selon le type d'échec", () => {
    const messages = { offline: "hors ligne", session: "session expirée", invalid: "réponse inattendue" };
    const message = (error: unknown) => apiErrorMessage(error, "échec", messages);
    assert.equal(message(new ApiError("offline", 0, "")), "hors ligne");
    assert.equal(message(new ApiError("session", 401, "Session requise.")), "session expirée");
    assert.equal(message(new ApiError("invalid", 200, "")), "réponse inattendue");
    assert.equal(message(new ApiError("server", 409, "Tournoi complet.")), "Tournoi complet.");
    assert.equal(message(new ApiError("server", 500, "")), "échec", "sans message du serveur : repli");
    assert.equal(message(new Error("bug")), "échec", "erreur qui ne vient pas d'un appel : repli");
  });

  it("GET par défaut, sans corps ni content-type", async () => {
    const fetchMock = respond(200, {});
    await api("/api/x", { cache: "no-store" });
    const [[, init]] = fetchMock.mock.calls as unknown as [string, RequestInit][];
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.cache, "no-store");
  });
});
