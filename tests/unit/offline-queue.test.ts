import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  QUEUE_VERSION,
  addOp,
  applyOps,
  classifyResponse,
  clearQueue,
  memoryQueueStore,
  pendingLineIds,
  readOps,
  replayQueue,
  requestFor,
  type QueuedOp,
  type SendResponse,
} from "../../src/lib/offline-queue";
import type { CollectionItemDTO } from "../../src/lib/types";

const conditions = [
  { code: "NM", name: "Near Mint", sortOrder: 1 },
  { code: "LP", name: "Lightly Played", sortOrder: 2 },
];

function line(id: string, printingId: string, quantity: number, conditionCode = "NM"): CollectionItemDTO {
  return {
    id,
    printingId,
    conditionCode,
    conditionName: conditionCode,
    quantity,
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}

const save = (quantity: number, printingId = "p1") =>
  ({ kind: "save", lineId: "tmp_a", payload: { printingId, conditionCode: "NM", quantity, mode: "add" } }) as const;

describe("file hors ligne de la collection : compactage", () => {
  it("ajout puis modification : un seul ajout de 3 exemplaires", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    const ops = await addOp(store, "u1", { kind: "patch", lineId: "tmp_a", payload: { quantity: 3 } });
    assert.equal(ops.length, 1);
    assert.equal(ops[0].kind, "save");
    assert.deepEqual(ops[0].payload, { printingId: "p1", conditionCode: "NM", quantity: 3, mode: "set" });
  });

  it("ajout puis suppression : plus rien en file", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(2));
    await addOp(store, "u1", { kind: "patch", lineId: "tmp_a", payload: { notes: "x" } });
    const ops = await addOp(store, "u1", { kind: "delete", lineId: "tmp_a", payload: null });
    assert.deepEqual(ops, []);
  });

  it("ajout puis quantité 0 : plus rien en file", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(2));
    assert.deepEqual(await addOp(store, "u1", { kind: "patch", lineId: "tmp_a", payload: { quantity: 0 } }), []);
  });

  it("deux ajouts de la même ligne temporaire s'additionnent", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    const ops = await addOp(store, "u1", save(2));
    assert.equal(ops.length, 1);
    assert.equal((ops[0].payload as { quantity: number }).quantity, 3);
  });

  it("ne replie rien sur une ligne du serveur", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", { kind: "patch", lineId: "srv1", payload: { quantity: 2 } });
    const ops = await addOp(store, "u1", { kind: "delete", lineId: "srv1", payload: null });
    assert.deepEqual(
      ops.map((op) => [op.seq, op.kind]),
      [
        [1, "patch"],
        [2, "delete"],
      ],
    );
    assert.ok(ops.every((op) => op.v === QUEUE_VERSION && op.userId === "u1"));
  });

  it("garde les files des comptes séparées", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    assert.deepEqual(readOps(await store.read("u2")).ops, []);
    await clearQueue(store, "u1");
    assert.deepEqual(readOps(await store.read("u1")).ops, []);
  });
});

describe("file hors ligne de la collection : affichage", () => {
  it("applique ajout, fusion, modification et suppression", () => {
    const items = [line("srv1", "p1", 1), line("srv2", "p2", 4)];
    const ops: QueuedOp[] = [
      { v: 1, seq: 1, userId: "u1", lineId: "srv1", kind: "save", createdAt: "x", payload: { printingId: "p1", conditionCode: "NM", quantity: 2, mode: "add" } },
      { v: 1, seq: 2, userId: "u1", lineId: "tmp_b", kind: "save", createdAt: "2026-02-01", payload: { printingId: "p3", conditionCode: "LP", quantity: 1, mode: "add" } },
      { v: 1, seq: 3, userId: "u1", lineId: "srv2", kind: "delete", createdAt: "x", payload: null },
    ];
    const shown = applyOps(items, ops, conditions);
    assert.deepEqual(
      shown.map((item) => [item.id, item.quantity, item.conditionName]),
      [
        ["srv1", 3, "NM"],
        ["tmp_b", 1, "Lightly Played"],
      ],
    );
    assert.deepEqual([...pendingLineIds(ops)], ["srv1", "tmp_b", "srv2"]);
  });

  it("un changement d'état fusionne avec la ligne existante", () => {
    const items = [line("a", "p1", 1, "NM"), line("b", "p1", 2, "LP")];
    const ops: QueuedOp[] = [
      { v: 1, seq: 1, userId: "u1", lineId: "a", kind: "patch", createdAt: "x", payload: { conditionCode: "LP" } },
    ];
    assert.deepEqual(
      applyOps(items, ops, conditions).map((item) => [item.id, item.quantity]),
      [["b", 3]],
    );
  });
});

describe("file hors ligne de la collection : rejeu", () => {
  function server(responses: Record<string, SendResponse | ((op: QueuedOp) => SendResponse)>) {
    const sent: QueuedOp[] = [];
    const send = async (op: QueuedOp) => {
      sent.push(op);
      const response = responses[`${op.kind}:${op.lineId}`] ?? responses[op.kind];
      if (!response) throw new TypeError("Failed to fetch");
      return typeof response === "function" ? response(op) : response;
    };
    return { sent, send };
  }

  it("envoie dans l'ordre et remplace l'id temporaire après l'ajout", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    // Envoi de l'ajout en cours : la modification suivante ne s'y replie pas.
    await store.update("u1", (record) => ({ ...record, sending: 1 }));
    await addOp(store, "u1", { kind: "patch", lineId: "tmp_a", payload: { quantity: 5 } });
    await store.update("u1", (record) => ({ ...record, sending: null }));
    const { sent, send } = server({
      save: { status: 200, body: { item: line("srv9", "p1", 1), deletedId: null } },
      patch: { status: 200, body: { item: line("srv9", "p1", 5), deletedId: null } },
    });
    const report = await replayQueue(store, "u1", send);
    assert.equal(report.stop, "done");
    assert.deepEqual(
      sent.map((op) => [op.kind, op.lineId]),
      [
        ["save", "tmp_a"],
        ["patch", "srv9"],
      ],
    );
    assert.equal(report.applied.length, 2);
    // Un id temporaire resté dans l'interface vise désormais la ligne du serveur.
    const ops = await addOp(store, "u1", { kind: "delete", lineId: "tmp_a", payload: null });
    assert.equal(ops[0].lineId, "srv9");
    assert.equal(requestFor(ops[0]).url, "/api/collection/srv9");
  });

  it("session refusée : s'arrête et garde la file", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    await addOp(store, "u1", { kind: "patch", lineId: "srv1", payload: { quantity: 2 } });
    const { sent, send } = server({ save: { status: 401, body: {} } });
    const report = await replayQueue(store, "u1", send);
    assert.equal(report.stop, "auth");
    assert.equal(sent.length, 1);
    assert.equal(report.remaining.length, 2);
    assert.equal((await store.read("u1"))?.sending, null);
  });

  it("erreur réseau ou 5xx : s'arrête pour réessayer", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    assert.equal((await replayQueue(store, "u1", server({}).send)).stop, "retry");
    assert.equal((await replayQueue(store, "u1", server({ save: { status: 503, body: {} } }).send)).stop, "retry");
    assert.equal(readOps(await store.read("u1")).ops.length, 1);
  });

  it("refus définitif : retire l'opération, la signale et continue", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", { kind: "patch", lineId: "gone", payload: { quantity: 2 } });
    await addOp(store, "u1", { kind: "delete", lineId: "srv2", payload: null });
    const { sent, send } = server({
      "patch:gone": { status: 404, body: { error: "Ligne introuvable." } },
      delete: { status: 200, body: { item: null, deletedId: "srv2" } },
    });
    const report = await replayQueue(store, "u1", send);
    assert.equal(report.stop, "done");
    assert.equal(sent.length, 2);
    assert.deepEqual(report.rejected.map((entry) => [entry.op.lineId, entry.error]), [["gone", "Ligne introuvable."]]);
    assert.deepEqual(report.remaining, []);
  });

  it("ajout refusé : les opérations suivantes sur la ligne sont abandonnées", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", save(1));
    await store.update("u1", (record) => ({ ...record, sending: 1 }));
    await addOp(store, "u1", { kind: "patch", lineId: "tmp_a", payload: { notes: "n" } });
    await store.update("u1", (record) => ({ ...record, sending: null }));
    const { sent, send } = server({ save: { status: 400, body: { error: "Carte introuvable." } } });
    const report = await replayQueue(store, "u1", send);
    assert.equal(sent.length, 1);
    assert.equal(report.rejected.length, 1);
    assert.deepEqual(report.remaining, []);
  });

  it("abandonne une opération illisible sans bloquer la file", async () => {
    const store = memoryQueueStore();
    await addOp(store, "u1", { kind: "delete", lineId: "srv1", payload: null });
    await store.update("u1", (record) => ({ ...record, ops: [{ v: 0, kind: "save" }, ...record.ops] }));
    const { sent, send } = server({ delete: { status: 200, body: { item: null, deletedId: "srv1" } } });
    const report = await replayQueue(store, "u1", send);
    assert.equal(report.corrupted, 1);
    assert.equal(sent.length, 1);
    assert.equal(report.stop, "done");
  });

  it("classe les réponses", () => {
    assert.deepEqual(
      [200, 401, 400, 404, 409, 422, 0, 408, 429, 500, 503].map(classifyResponse),
      ["ok", "auth", "rejected", "rejected", "rejected", "rejected", "retry", "retry", "retry", "retry", "retry"],
    );
  });
});
