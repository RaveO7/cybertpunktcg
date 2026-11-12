/**
 * Scénario « ancienne interface après un déploiement » : la liste de souhaits reçoit une réponse dont un
 * champ attendu manque. L'enregistrement échoue proprement (message traduit, erreur signalée) et la
 * liste affichée n'est pas touchée (elle n'est mise à jour qu'après une réponse vérifiée, comme dans
 * WishlistProvider). `fetch` simulé ; vrais schéma et messages français.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import frErrors from "../../src/i18n/messages/fr/errors.json";
import type { WishlistItemDTO } from "../../src/lib/api-responses";
import { api, apiErrorMessage } from "../../src/lib/client/api";

const request = frErrors.request;
const messages = { offline: request.offline, session: request.sessionExpired, invalid: request.unexpected };

const existing: WishlistItemDTO = {
  id: "w1",
  printingId: "p1",
  targetPrice: null,
  notes: null,
  alertAt: null,
  alertPrice: null,
  alertSeen: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("réponse au format inattendu", () => {
  it("liste de souhaits : réponse sans printingId → message traduit, liste inchangée, erreur signalée", async () => {
    const { printingId: _missing, ...withoutPrintingId } = { ...existing, id: "w2" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ item: withoutPrintingId }), { status: 200 })));
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let items = [existing];
    let shown: string | null = null;
    try {
      const { item } = await api("/api/wishlist", { body: { printingId: "p2" }, schema: "wishlistItemResponseSchema" });
      items = [...items, item];
    } catch (error) {
      shown = apiErrorMessage(error, request.saveFailed, messages);
    }

    assert.equal(shown, "Réponse inattendue du serveur. Rechargez l’application.");
    assert.deepEqual(items, [existing]);
    assert.equal(report.mock.calls.length, 1, "le problème est signalé pour diagnostic");
  });
});
