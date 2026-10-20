// File des modifications de la collection faites hors ligne, gardée sur l'appareil (IndexedDB) et
// rejouée dans l'ordre au retour du réseau. Un enregistrement par compte : un autre compte connecté
// sur l'appareil ne voit ni n'envoie ces modifications.
// Une ligne créée hors ligne porte un id « tmp_… » : ses modifications et sa suppression se replient sur
// son ajout tant qu'il n'est pas parti, puis l'id du serveur le remplace.

import type { CollectionItemDTO, ConditionDTO } from "@/lib/types";

/** Version du format d'une opération : une opération d'une autre version est abandonnée. */
export const QUEUE_VERSION = 1;

export const TEMP_PREFIX = "tmp_";

/** Doit rester identique à MAX_LINE_QUANTITY (collection-mutate.ts). */
const MAX_LINE_QUANTITY = 999;

export type SavePayload = {
  printingId: string;
  conditionCode: string;
  quantity: number;
  mode: "add" | "set";
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

export type PatchPayload = {
  conditionCode?: string;
  quantity?: number;
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

type OpBase = { v: number; seq: number; userId: string; lineId: string; createdAt: string };

export type QueuedOp =
  | (OpBase & { kind: "save"; payload: SavePayload })
  | (OpBase & { kind: "patch"; payload: PatchPayload })
  | (OpBase & { kind: "delete"; payload: null });

export type NewOp =
  | { kind: "save"; lineId: string; payload: SavePayload }
  | { kind: "patch"; lineId: string; payload: PatchPayload }
  | { kind: "delete"; lineId: string; payload: null };

/** Contenu enregistré pour un compte. */
export type QueueRecord = {
  userId: string;
  nextSeq: number;
  ops: unknown[];
  /** Opération en cours d'envoi : rien ne s'y replie, sa réponse ne refléterait pas l'ajout. */
  sending: number | null;
  /** Ids temporaires déjà remplacés par celui du serveur. */
  aliases: Record<string, string>;
};

/** Stockage de la file ; `update` est atomique (une transaction IndexedDB). */
export type QueueStore = {
  read(userId: string): Promise<QueueRecord | null>;
  update(userId: string, change: (record: QueueRecord) => QueueRecord): Promise<QueueRecord>;
};

export function isTempId(id: string) {
  return id.startsWith(TEMP_PREFIX);
}

export function newTempId() {
  const crypto = globalThis.crypto;
  const random =
    crypto && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${TEMP_PREFIX}${random}`;
}

function emptyRecord(userId: string): QueueRecord {
  return { userId, nextSeq: 1, ops: [], sending: null, aliases: {} };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Opération lisible et de la version courante, ou null. */
export function parseOp(value: unknown): QueuedOp | null {
  if (!isObject(value) || value.v !== QUEUE_VERSION) return null;
  if (typeof value.seq !== "number" || typeof value.userId !== "string" || typeof value.lineId !== "string") return null;
  if (typeof value.createdAt !== "string") return null;
  if (value.kind === "delete") return value as QueuedOp;
  if (!isObject(value.payload)) return null;
  if (value.kind === "patch") return value as QueuedOp;
  if (value.kind !== "save") return null;
  const payload = value.payload;
  if (typeof payload.printingId !== "string" || typeof payload.conditionCode !== "string") return null;
  if (typeof payload.quantity !== "number" || (payload.mode !== "add" && payload.mode !== "set")) return null;
  return value as QueuedOp;
}

/** Opérations lisibles d'un enregistrement, et nombre d'opérations illisibles. */
export function readOps(record: QueueRecord | null): { ops: QueuedOp[]; corrupted: number } {
  if (!record || !Array.isArray(record.ops)) return { ops: [], corrupted: 0 };
  const ops: QueuedOp[] = [];
  let corrupted = 0;
  for (const raw of record.ops) {
    const op = parseOp(raw);
    if (op) ops.push(op);
    else corrupted += 1;
  }
  return { ops, corrupted };
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;
}

/**
 * Ajoute une opération à la file en la repliant si possible :
 * - modification ou suppression d'une ligne `tmp_` sur son ajout encore en attente ;
 * - deux ajouts de la même ligne `tmp_`.
 */
export function enqueueOp(record: QueueRecord, userId: string, next: NewOp, createdAt = new Date().toISOString()): QueueRecord {
  const ops = readOps(record).ops;
  const lineId = record.aliases[next.lineId] ?? next.lineId;
  const op = { ...next, lineId } as NewOp;
  const append = (): QueueRecord => ({
    ...record,
    nextSeq: record.nextSeq + 1,
    ops: [...ops, { ...op, v: QUEUE_VERSION, seq: record.nextSeq, userId, createdAt }],
  });

  if (!isTempId(lineId)) return append();
  const saveIndex = ops.findIndex((candidate) => candidate.kind === "save" && candidate.lineId === lineId);
  const save = saveIndex === -1 ? null : ops[saveIndex];
  if (!save || save.kind !== "save" || save.seq === record.sending) return append();
  // Des opérations ont déjà été ajoutées après l'ajout (cas d'un envoi en cours) : on garde l'ordre.
  if (ops.some((candidate) => candidate.lineId === lineId && candidate.seq > save.seq)) return append();

  const replaceSave = (payload: SavePayload | null): QueueRecord => ({
    ...record,
    ops: payload
      ? ops.map((candidate, index) => (index === saveIndex ? { ...save, payload } : candidate))
      : ops.filter((_, index) => index !== saveIndex),
  });

  if (op.kind === "delete") return replaceSave(null);
  if (op.kind === "patch") {
    const { quantity, conditionCode, ...fields } = op.payload;
    if (quantity != null && quantity <= 0) return replaceSave(null);
    return replaceSave({
      ...save.payload,
      ...defined(fields),
      ...(conditionCode !== undefined ? { conditionCode } : {}),
      ...(quantity != null ? { mode: "set" as const, quantity } : {}),
    });
  }
  const { quantity, mode, ...fields } = op.payload;
  return replaceSave({
    ...save.payload,
    ...defined(fields),
    quantity: mode === "set" ? quantity : save.payload.quantity + quantity,
    mode: mode === "set" ? "set" : save.payload.mode,
  });
}

/** Ids des lignes visées par une opération en attente. */
export function pendingLineIds(ops: QueuedOp[]): Set<string> {
  return new Set(ops.map((op) => op.lineId));
}

const capped = (quantity: number) => Math.min(quantity, MAX_LINE_QUANTITY);

/**
 * Collection affichée : celle du serveur (ou du cache) avec les opérations en attente, appliquées comme le
 * ferait le serveur (fusion des lignes de même carte × état, quantité 0 = suppression).
 */
export function applyOps(items: CollectionItemDTO[], ops: QueuedOp[], conditions: ConditionDTO[] = []): CollectionItemDTO[] {
  if (ops.length === 0) return items;
  const conditionName = (code: string) => conditions.find((condition) => condition.code === code)?.name ?? code;
  let next = items;
  for (const op of ops) {
    if (op.kind === "delete") {
      next = next.filter((item) => item.id !== op.lineId);
      continue;
    }
    if (op.kind === "save") {
      const { payload } = op;
      const existing =
        next.find((item) => item.printingId === payload.printingId && item.conditionCode === payload.conditionCode) ??
        null;
      if (payload.mode === "add" && payload.quantity <= 0) continue;
      if (payload.quantity <= 0) {
        if (existing) next = next.filter((item) => item.id !== existing.id);
        continue;
      }
      const fields = defined({
        notes: payload.notes,
        purchasePrice: payload.purchasePrice,
        purchaseCurrency: payload.purchaseCurrency,
      });
      if (existing) {
        const quantity = capped(payload.mode === "add" ? existing.quantity + payload.quantity : payload.quantity);
        next = next.map((item) => (item.id === existing.id ? { ...item, ...fields, quantity } : item));
      } else {
        next = [
          ...next,
          {
            id: op.lineId,
            printingId: payload.printingId,
            conditionCode: payload.conditionCode,
            conditionName: conditionName(payload.conditionCode),
            quantity: capped(payload.quantity),
            notes: payload.notes ?? null,
            purchasePrice: payload.purchasePrice ?? null,
            purchaseCurrency: payload.purchaseCurrency ?? null,
            addedAt: op.createdAt,
          },
        ];
      }
      continue;
    }
    const current = next.find((item) => item.id === op.lineId);
    if (!current) continue;
    const { quantity, conditionCode, ...rest } = op.payload;
    if (quantity != null && quantity <= 0) {
      next = next.filter((item) => item.id !== current.id);
      continue;
    }
    const fields = defined(rest);
    const code = conditionCode ?? current.conditionCode;
    const target =
      code !== current.conditionCode
        ? next.find((item) => item.printingId === current.printingId && item.conditionCode === code)
        : undefined;
    if (target) {
      const merged = { ...target, ...fields, quantity: capped((quantity ?? current.quantity) + target.quantity) };
      next = next.filter((item) => item.id !== current.id).map((item) => (item.id === target.id ? merged : item));
    } else {
      const updated = {
        ...current,
        ...fields,
        conditionCode: code,
        conditionName: code === current.conditionCode ? current.conditionName : conditionName(code),
        quantity: quantity ?? current.quantity,
      };
      next = next.map((item) => (item.id === current.id ? updated : item));
    }
  }
  return next;
}

/** Réponse du serveur à une opération ; `status: 0` = pas de réseau. */
export type SendResponse = { status: number; body: unknown };

export type Outcome = "ok" | "auth" | "rejected" | "retry";

/** 2xx envoyé ; 401 session à rouvrir ; autre 4xx refus définitif ; réseau, 408, 429, 5xx : plus tard. */
export function classifyResponse(status: number): Outcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "auth";
  if (status === 0 || status === 408 || status === 429 || status >= 500) return "retry";
  return "rejected";
}

export type MutationResult = { item: CollectionItemDTO | null; deletedId: string | null };

export type ReplayReport = {
  applied: { op: QueuedOp; result: MutationResult }[];
  rejected: { op: QueuedOp; error: string | null }[];
  /** Opérations illisibles abandonnées. */
  corrupted: number;
  /** « done » : file vide ; « auth » : session refusée ; « retry » : à reprendre plus tard. */
  stop: "done" | "auth" | "retry";
  remaining: QueuedOp[];
};

function readResult(body: unknown): MutationResult {
  const result = isObject(body) ? body : {};
  return {
    item: isObject(result.item) ? (result.item as CollectionItemDTO) : null,
    deletedId: typeof result.deletedId === "string" ? result.deletedId : null,
  };
}

/** Retire l'opération envoyée ; après un ajout, l'id temporaire est remplacé dans la suite de la file. */
function settle(record: QueueRecord, sent: QueuedOp, serverId: string | null | undefined): QueueRecord {
  let ops = readOps(record).ops.filter((op) => op.seq !== sent.seq);
  const aliases = { ...record.aliases };
  if (serverId !== undefined && isTempId(sent.lineId)) {
    if (serverId) {
      aliases[sent.lineId] = serverId;
      ops = ops.map((op) => (op.lineId === sent.lineId ? { ...op, lineId: serverId } : op));
    } else {
      // Ajout sans ligne créée (quantité 0) : rien à modifier ensuite.
      ops = ops.filter((op) => op.lineId !== sent.lineId);
    }
  }
  return { ...record, ops, aliases, sending: null };
}

/**
 * Envoie les opérations du compte une par une, dans l'ordre. S'arrête sur une session refusée ou une erreur
 * temporaire ; une opération refusée définitivement est retirée et signalée.
 */
export async function replayQueue(
  store: QueueStore,
  userId: string,
  send: (op: QueuedOp) => Promise<SendResponse>,
): Promise<ReplayReport> {
  const report: ReplayReport = { applied: [], rejected: [], corrupted: 0, stop: "done", remaining: [] };
  for (;;) {
    let op: QueuedOp | undefined;
    const record = await store.update(userId, (current) => {
      const { ops, corrupted } = readOps(current);
      report.corrupted += corrupted;
      op = ops[0];
      return { ...current, ops, sending: op?.seq ?? null };
    });
    if (!op) {
      report.remaining = readOps(record).ops;
      return report;
    }
    let response: SendResponse;
    try {
      response = await send(op);
    } catch {
      response = { status: 0, body: null };
    }
    const outcome = classifyResponse(response.status);
    if (outcome === "auth" || outcome === "retry") {
      const after = await store.update(userId, (current) => ({ ...current, sending: null }));
      report.stop = outcome;
      report.remaining = readOps(after).ops;
      return report;
    }
    const sent = op;
    if (outcome === "ok") {
      const result = readResult(response.body);
      report.applied.push({ op: sent, result });
      await store.update(userId, (current) =>
        settle(current, sent, sent.kind === "save" ? (result.item?.id ?? null) : undefined),
      );
    } else {
      const body = isObject(response.body) ? response.body : {};
      report.rejected.push({ op: sent, error: typeof body.error === "string" ? body.error : null });
      // Ajout refusé : les opérations suivantes sur cette ligne n'ont plus de cible.
      await store.update(userId, (current) => settle(current, sent, sent.kind === "save" ? null : undefined));
    }
  }
}

/** Requête HTTP d'une opération. */
export function requestFor(op: QueuedOp): { url: string; init: RequestInit } {
  const headers = { "content-type": "application/json" };
  if (op.kind === "save") return { url: "/api/collection", init: { method: "POST", headers, body: JSON.stringify(op.payload) } };
  const url = `/api/collection/${encodeURIComponent(op.lineId)}`;
  if (op.kind === "patch") return { url, init: { method: "PATCH", headers, body: JSON.stringify(op.payload) } };
  return { url, init: { method: "DELETE", headers } };
}

export async function addOp(store: QueueStore, userId: string, op: NewOp): Promise<QueuedOp[]> {
  const record = await store.update(userId, (current) => enqueueOp(current, userId, op));
  return readOps(record).ops;
}

export async function clearQueue(store: QueueStore, userId: string): Promise<void> {
  await store.update(userId, () => emptyRecord(userId));
}

/** Stockage en mémoire (tests, ou navigateur sans IndexedDB). */
export function memoryQueueStore(): QueueStore {
  const records = new Map<string, QueueRecord>();
  return {
    async read(userId) {
      return records.get(userId) ?? null;
    },
    async update(userId, change) {
      const next = change(records.get(userId) ?? emptyRecord(userId));
      records.set(userId, next);
      return next;
    },
  };
}

const DB_NAME = "cptcg-queue";
const STORE_NAME = "collection";

function promised<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Stockage IndexedDB (base `cptcg-queue`), ou en mémoire si IndexedDB est indisponible. */
export function indexedDbQueueStore(): QueueStore {
  if (typeof indexedDB === "undefined") return memoryQueueStore();
  let opening: Promise<IDBDatabase> | null = null;
  const fallback = memoryQueueStore();
  function open() {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "userId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return opening;
  }
  return {
    async read(userId) {
      try {
        const db = await open();
        const value = await promised(db.transaction(STORE_NAME).objectStore(STORE_NAME).get(userId));
        return (value as QueueRecord | undefined) ?? null;
      } catch {
        return fallback.read(userId);
      }
    },
    async update(userId, change) {
      let db: IDBDatabase;
      try {
        db = await open();
      } catch {
        // Navigation privée ou stockage bloqué : la file vit en mémoire.
        return fallback.update(userId, change);
      }
      return new Promise<QueueRecord>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        let next: QueueRecord;
        const request = store.get(userId);
        request.onsuccess = () => {
          const current = (request.result as QueueRecord | undefined) ?? emptyRecord(userId);
          next = change({ ...emptyRecord(userId), ...current });
          store.put(next);
        };
        transaction.oncomplete = () => resolve(next);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    },
  };
}
