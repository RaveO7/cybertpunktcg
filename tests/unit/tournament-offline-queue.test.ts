import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createOfflineQueue, type QueueStorage, type QueuedCommand, type SendOutcome } from "../../src/lib/tournament/offline-queue";

function memoryStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const brokenStorage: QueueStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("file hors connexion de l'organisateur", () => {
  it("renvoie les actions dans l'ordre, chacune avec un identifiant unique", async () => {
    const sent: QueuedCommand[] = [];
    const queue = createOfflineQueue("t1", async (item) => {
      sent.push(item);
      return { kind: "ok", result: null };
    }, memoryStorage());
    queue.enqueue({ type: "setResult", matchId: "m1" });
    queue.enqueue({ type: "setResult", matchId: "m2" });
    queue.enqueue({ type: "setResult", matchId: "m3" });
    const report = await queue.flush();
    assert.deepEqual(sent.map((item) => item.command.matchId), ["m1", "m2", "m3"]);
    assert.equal(new Set(sent.map((item) => item.clientActionId)).size, 3);
    assert.equal(report.remaining, 0);
    assert.equal(queue.pending().length, 0);
  });

  it("s'arrête sur une erreur réseau et garde l'action et les suivantes", async () => {
    let online = false;
    const sent: string[] = [];
    const queue = createOfflineQueue("t2", async (item) => {
      if (!online) throw new TypeError("Failed to fetch");
      sent.push(item.command.matchId as string);
      return { kind: "ok", result: null };
    }, memoryStorage());
    queue.enqueue({ type: "setResult", matchId: "m1" });
    queue.enqueue({ type: "setResult", matchId: "m2" });
    const offline = await queue.flush();
    assert.equal(offline.remaining, 2);
    assert.deepEqual(sent, []);
    online = true;
    await queue.flush();
    assert.deepEqual(sent, ["m1", "m2"]);
  });

  it("un renvoi garde le même clientActionId (le serveur ne l'appliquera pas deux fois)", async () => {
    const ids: string[] = [];
    let attempts = 0;
    const queue = createOfflineQueue("t3", async (item) => {
      ids.push(item.clientActionId);
      attempts += 1;
      return attempts === 1 ? { kind: "retry" } : { kind: "ok", result: null };
    }, memoryStorage());
    queue.enqueue({ type: "addPlayer", name: "Neo" });
    await queue.flush();
    await queue.flush();
    assert.equal(ids.length, 2);
    assert.equal(ids[0], ids[1]);
  });

  it("un refus (4xx) retire l'action, la signale et passe à la suivante", async () => {
    const queue = createOfflineQueue("t4", async (item): Promise<SendOutcome> => {
      if (item.command.matchId === "m1") return { kind: "rejected", status: 409, error: "Ce match a été validé entre-temps avec un autre score." };
      return { kind: "ok", result: { ok: true } };
    }, memoryStorage());
    const first = queue.enqueue({ type: "setResult", matchId: "m1" });
    const second = queue.enqueue({ type: "setResult", matchId: "m2" });
    const report = await queue.flush();
    assert.equal(report.outcomes.get(first.clientActionId)?.kind, "rejected");
    assert.equal(report.outcomes.get(second.clientActionId)?.kind, "ok");
    assert.equal(queue.pending().length, 0);
  });

  it("survit au rechargement de la page (stockage)", async () => {
    const storage = memoryStorage();
    const before = createOfflineQueue("t5", async () => ({ kind: "retry" }), storage);
    before.enqueue({ type: "closeRound" });
    const after = createOfflineQueue("t5", async () => ({ kind: "ok", result: null }), storage);
    assert.equal(after.pending().length, 1);
    await after.flush();
    assert.equal(storage.data.size, 0, "file vide : la clé est retirée");
  });

  it("stockage indisponible : la file fonctionne en mémoire", async () => {
    const sent: string[] = [];
    const queue = createOfflineQueue("t6", async (item) => {
      sent.push(item.command.type);
      return { kind: "ok", result: null };
    }, brokenStorage);
    queue.enqueue({ type: "pauseClock" });
    assert.equal(queue.pending().length, 1);
    await queue.flush();
    assert.deepEqual(sent, ["pauseClock"]);
    const none = createOfflineQueue("t7", async () => ({ kind: "ok", result: null }), null);
    none.enqueue({ type: "resumeClock" });
    assert.equal(none.pending().length, 1);
  });

  it("un seul passage à la fois, et les abonnés sont prévenus", async () => {
    let calls = 0;
    let notified = 0;
    const queue = createOfflineQueue("t8", async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { kind: "ok", result: null };
    }, memoryStorage());
    queue.subscribe(() => (notified += 1));
    queue.enqueue({ type: "pairRound" });
    await Promise.all([queue.flush(), queue.flush()]);
    assert.equal(calls, 1);
    assert.ok(notified >= 2, "ajout puis retrait");
  });
});
