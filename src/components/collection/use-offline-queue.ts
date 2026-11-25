"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { MutationResult } from "@/lib/api-responses";
import { ApiError, api, loadResponseSchemas } from "@/lib/client/api";
import { collectionBody, requestCollection } from "@/lib/boot-requests";
import {
  type NewOp,
  type QueuedOp,
  type QueueStore,
  type SendResponse,
  addOp,
  applyOps,
  indexedDbQueueStore,
  pendingLineIds,
  readOps,
  replayQueue,
  requestFor,
} from "@/lib/offline-queue";
import type { AuthUser, CatalogDTO, CollectionItemDTO } from "@/lib/types";
import type { SyncError } from "@/components/collection/types";

/** Délais avant de rejouer la file après une erreur temporaire (réseau, 5xx). */
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];

const NO_OPS: QueuedOp[] = [];

/** Dernières valeurs affichées, lues par les callbacks asynchrones sans les relancer. */
export type LatestCollection = {
  items: CollectionItemDTO[];
  serverItems: CollectionItemDTO[];
  catalog: CatalogDTO | null;
};

/**
 * File des modifications faites hors ligne (IndexedDB) : lecture, envoi une opération à la fois avec verrou
 * entre onglets, reprise après erreur temporaire, et collection affichée = collection du serveur + file.
 */
export function useOfflineQueue({
  user,
  serverItems,
  catalog,
  errors,
  endSession,
  applyResult,
  setItems,
  edits,
}: {
  user: AuthUser | null;
  serverItems: CollectionItemDTO[];
  catalog: CatalogDTO | null;
  errors: (key: "saveFailed" | "syncCorrupted") => string;
  endSession: () => void;
  applyResult: (result: MutationResult) => void;
  setItems: (items: CollectionItemDTO[]) => void;
  /** Compteur des modifications locales : une réponse partie avant l'une d'elles est périmée. */
  edits: MutableRefObject<number>;
}) {
  // File du compte qui l'a lue : un autre compte connecté ne la voit pas.
  const [queued, setQueued] = useState<{ userId: string | null; ops: QueuedOp[] }>({ userId: null, ops: [] });
  const userId = user?.id ?? null;
  const ops = userId && queued.userId === userId ? queued.ops : NO_OPS;
  const items = useMemo(() => applyOps(serverItems, ops, catalog?.conditions), [serverItems, ops, catalog]);
  const pendingIds = useMemo(() => pendingLineIds(ops), [ops]);
  const opsRef = useRef(ops);
  const userRef = useRef(user);
  const latest = useRef<LatestCollection>({ items: [], serverItems: [], catalog: null });
  useEffect(() => {
    opsRef.current = ops;
    userRef.current = user;
    latest.current = { items, serverItems, catalog };
  }, [ops, user, items, serverItems, catalog]);
  const [syncing, setSyncing] = useState(false);
  const [allSyncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const syncErrors = useMemo(() => allSyncErrors.filter((entry) => entry.userId === userId), [allSyncErrors, userId]);
  const storeRef = useRef<QueueStore | null>(null);
  const queueStore = () => (storeRef.current ??= indexedDbQueueStore());
  const replayRef = useRef<() => Promise<void>>(async () => undefined);
  const replaying = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStep = useRef(0);

  /** Nom de la carte visée par une opération, pour les messages d'échec. */
  function cardName(op: QueuedOp) {
    const { serverItems: server, items: shown, catalog: current } = latest.current;
    const printingId =
      op.kind === "save"
        ? op.payload.printingId
        : (server.find((item) => item.id === op.lineId) ?? shown.find((item) => item.id === op.lineId))?.printingId;
    const printing = current?.printings.find((candidate) => candidate.id === printingId);
    if (!printing) return null;
    return printing.localizedName ?? current?.cards.find((card) => card.id === printing.cardId)?.name ?? null;
  }

  /** Modification gardée sur l'appareil, appliquée tout de suite à la collection affichée. */
  async function enqueue(forUserId: string, op: NewOp) {
    const next = await addOp(queueStore(), forUserId, op);
    setQueued({ userId: forUserId, ops: next });
  }

  /** Envoi d'une opération de la file : statut et corps, classés par replayQueue (protocole de la file). */
  async function sendOp(op: QueuedOp): Promise<SendResponse> {
    const { url, method, body } = requestFor(op);
    try {
      return { status: 200, body: await api(url, { method, body }) };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return { status: error.status, body: { error: error.message } };
    }
  }

  /** Envoie la file du compte, une opération à la fois ; un seul onglet à la fois (verrou). */
  async function replay() {
    const current = userRef.current;
    if (!current || replaying.current || !navigator.onLine) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    replaying.current = true;
    let again = false;
    try {
      const store = queueStore();
      // La file a pu changer dans un autre onglet.
      const stored = readOps(await store.read(current.id)).ops;
      if (userRef.current?.id !== current.id) return;
      setQueued({ userId: current.id, ops: stored });
      if (stored.length === 0) return;
      setSyncing(true);
      const run = () => replayQueue(store, current.id, sendOp);
      const report = navigator.locks
        ? await navigator.locks.request("cptcg-collection-queue", { ifAvailable: true }, (lock) => (lock ? run() : null))
        : await run();
      // Un autre onglet synchronise déjà.
      if (!report || userRef.current?.id !== current.id) return;
      const messages: SyncError[] = report.rejected.map(({ op, error }) => ({
        id: `${op.userId}:${op.seq}`,
        userId: current.id,
        kind: "rejected",
        card: cardName(op),
        message: error || errors("saveFailed"),
      }));
      if (report.corrupted) {
        messages.push({ id: `corrupted:${Date.now()}`, userId: current.id, kind: "corrupted", card: null, message: errors("syncCorrupted") });
      }
      for (const { result } of report.applied) applyResult(result);
      // Réponse illisible : la collection affichée est relue sur le serveur en fin de passage (file vide).
      if (report.unverified) console.error("Réponse au format inattendu", { url: "/api/collection", count: report.unverified });
      setQueued({ userId: current.id, ops: report.remaining });
      if (messages.length) setSyncErrors((list) => [...list, ...messages]);
      if (report.stop === "auth") {
        // Session expirée : la file reste sur l'appareil jusqu'à la reconnexion de ce compte.
        endSession();
        return;
      }
      if (report.stop === "retry") {
        const delay = RETRY_DELAYS_MS[Math.min(retryStep.current, RETRY_DELAYS_MS.length - 1)];
        retryStep.current += 1;
        retryTimer.current = setTimeout(() => void replayRef.current(), delay);
        return;
      }
      retryStep.current = 0;
      // Modification ajoutée pendant la fin du passage : nouveau passage.
      const added = readOps(await store.read(current.id)).ops;
      if (added.length) {
        setQueued({ userId: current.id, ops: added });
        again = true;
        return;
      }
      // File vide : la collection affichée reprend exactement celle du serveur.
      const editsAtStart = edits.current;
      const [fresh, schemas] = await Promise.all([requestCollection(), loadResponseSchemas()]).catch(
        () => [null, null] as const,
      );
      const freshBody = fresh && schemas && collectionBody(schemas, fresh);
      if (freshBody && edits.current === editsAtStart && opsRef.current.length === 0) setItems(freshBody.items);
    } catch {
      // IndexedDB ou réseau indisponible : nouvel essai au prochain déclencheur.
    } finally {
      replaying.current = false;
      setSyncing(false);
      if (again) void replayRef.current();
    }
  }
  useEffect(() => {
    replayRef.current = replay;
  });

  // File du compte connecté, relue sur l'appareil puis envoyée si le réseau est là. Un autre compte ne la voit pas.
  useEffect(() => {
    retryStep.current = 0;
    if (!userId) return;
    let cancelled = false;
    void queueStore()
      .read(userId)
      .then((record) => {
        if (cancelled) return;
        setQueued({ userId, ops: readOps(record).ops });
        void replayRef.current();
      })
      // File hors ligne illisible : elle est ignorée, la collection du serveur fait foi.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Retour du réseau ou de l'onglet : la file repart.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void replayRef.current();
    };
    const onOnline = () => void replayRef.current();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return {
    items,
    ops,
    opsRef,
    pendingIds,
    syncing,
    syncErrors,
    dismissSyncError: (id: string) => setSyncErrors((list) => list.filter((entry) => entry.id !== id)),
    readLatest: () => latest.current,
    queueStore,
    enqueue,
    replay,
    replayRef,
  };
}
