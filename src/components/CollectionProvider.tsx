"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clearDataCache, prefetchCached } from "@/components/data-cache";
import { mutationFetch, useRequestErrors } from "@/components/send-json";
import { matchRoute } from "@/i18n/match";
import type { ImportLine } from "@/lib/collection-csv";
import { type BootRequests, requestCatalog, requestCollection, takeBootRequests } from "@/lib/boot-requests";
import { readSavedCollection } from "@/lib/offline";
import {
  type NewOp,
  type QueuedOp,
  type QueueStore,
  addOp,
  applyOps,
  clearQueue,
  indexedDbQueueStore,
  isTempId,
  newTempId,
  pendingLineIds,
  readOps,
  replayQueue,
  requestFor,
} from "@/lib/offline-queue";
import { disablePush } from "@/lib/push-client";
import { browserStorage, clearSessionUser, readSessionUser, writeSessionUser } from "@/lib/session-hint";
import type { AuthUser, CatalogDTO, CollectionItemDTO } from "@/lib/types";

export type ImportSummary = { created: number; updated: number; skipped: number };

const LOCAL_USER_KEY = "cptcg-user-id";

/**
 * Statut de la session, indépendant du chargement des données (`ready`) : « unknown » tant que rien
 * n'est mémorisé ni vérifié, « signed-out » seulement après un refus du serveur (401) ou la déconnexion.
 */
export type SessionStatus = "unknown" | "signed-in" | "signed-out";

/** Données des écrans les plus visités, chargées au repos pour qu'ils s'ouvrent sans attente. */
const WARM_URLS = ["/api/decks", "/api/tournaments", "/api/share", "/api/investment/history?"];

/** Délais avant de rejouer la file après une erreur temporaire (réseau, 5xx). */
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];

const NO_OPS: QueuedOp[] = [];

/** Modification refusée par le serveur pendant la synchronisation. */
export type SyncError = { id: string; userId: string; kind: "rejected" | "corrupted"; card: string | null; message: string };

/** Lance `task` quand le navigateur est au repos ; renvoie de quoi l'annuler. */
export function whenIdle(task: () => void) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(task, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(task, 1500);
  return () => clearTimeout(id);
}

type SaveInput = {
  printingId: string;
  conditionCode: string;
  quantity: number;
  mode: "add" | "set";
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

type PatchInput = {
  conditionCode?: string;
  quantity?: number;
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

type MutationResult = {
  item: CollectionItemDTO | null;
  deletedId: string | null;
  error?: string;
};

type CollectionContextValue = {
  session: SessionStatus;
  ready: boolean;
  error: string | null;
  /** Relance le chargement du catalogue et de la collection après une erreur. */
  retry: () => void;
  user: AuthUser | null;
  catalog: CatalogDTO | null;
  items: CollectionItemDTO[];
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  saveLine: (input: SaveInput) => Promise<void>;
  saveBatch: (input: {
    conditionCode: string;
    lines: { printingId: string; quantity: number }[];
  }) => Promise<void>;
  importLines: (input: { mode: "add" | "set"; lines: ImportLine[] }) => Promise<ImportSummary>;
  patchLine: (id: string, input: PatchInput) => Promise<void>;
  deleteLine: (id: string) => Promise<void>;
  /** Modifications faites hors ligne, pas encore envoyées au serveur. */
  pendingCount: number;
  /** Lignes visées par une modification en attente. */
  pendingIds: ReadonlySet<string>;
  syncing: boolean;
  syncErrors: SyncError[];
  dismissSyncError: (id: string) => void;
};

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function useCollection() {
  const value = useContext(CollectionContext);
  if (!value) throw new Error("useCollection doit être utilisé dans le provider.");
  return value;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<SessionStatus>("unknown");
  const [catalog, setCatalog] = useState<CatalogDTO | null>(null);
  // Collection du serveur (ou de la copie gardée) ; celle affichée y ajoute les modifications en attente.
  const [serverItems, setItems] = useState<CollectionItemDTO[]>([]);
  // File du compte qui l'a lue : un autre compte connecté ne la voit pas.
  const [queued, setQueued] = useState<{ userId: string | null; ops: QueuedOp[] }>({ userId: null, ops: [] });
  const userId = user?.id ?? null;
  const ops = userId && queued.userId === userId ? queued.ops : NO_OPS;
  const items = useMemo(() => applyOps(serverItems, ops, catalog?.conditions), [serverItems, ops, catalog]);
  const pendingIds = useMemo(() => pendingLineIds(ops), [ops]);
  const itemsRef = useRef(items);
  const serverItemsRef = useRef(serverItems);
  const opsRef = useRef(ops);
  const userRef = useRef(user);
  const catalogRef = useRef(catalog);
  useEffect(() => {
    itemsRef.current = items;
    serverItemsRef.current = serverItems;
    opsRef.current = ops;
    userRef.current = user;
    catalogRef.current = catalog;
  }, [items, serverItems, ops, user, catalog]);
  const [syncing, setSyncing] = useState(false);
  const [allSyncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const syncErrors = useMemo(() => allSyncErrors.filter((entry) => entry.userId === userId), [allSyncErrors, userId]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const errors = useRequestErrors();
  // Modifications locales de la collection : une réponse partie avant l'une d'elles est périmée.
  const edits = useRef(0);
  const storeRef = useRef<QueueStore | null>(null);
  const queueStore = () => (storeRef.current ??= indexedDbQueueStore());
  const replayRef = useRef<() => Promise<void>>(async () => undefined);

  function editItems(update: (current: CollectionItemDTO[]) => CollectionItemDTO[]) {
    edits.current += 1;
    setItems(update);
  }

  function applyResult(result: MutationResult) {
    editItems((current) => {
      let next = current;
      if (result.deletedId) next = next.filter((item) => item.id !== result.deletedId);
      if (result.item) {
        next = [...next.filter((item) => item.id !== result.item?.id), result.item];
      }
      return next;
    });
  }

  /** Session ouverte (connexion, inscription, vérification réussie) : mémorisée sur l'appareil. */
  function rememberSession(nextUser: AuthUser) {
    window.localStorage.removeItem(LOCAL_USER_KEY);
    writeSessionUser(browserStorage(), nextUser);
    setUser(nextUser);
    setSession("signed-in");
  }

  /** Session refusée par le serveur ou déconnexion : mémoire, utilisateur et données effacés. */
  function endSession() {
    clearSessionUser(browserStorage());
    setUser(null);
    setCatalog(null);
    setItems([]);
    setSession("signed-out");
    setReady(true);
  }

  async function loadBoundData() {
    // Erreur réseau : même message qu'une erreur serveur, l'écran propose de réessayer.
    const [freshCatalog, collection] = await Promise.all([requestCatalog(), requestCollection()]).catch(
      () => [null, null] as const,
    );
    if (collection?.status === 401) {
      endSession();
      throw new Error(errors("sessionLost"));
    }
    if (!freshCatalog || !collection?.body?.items) {
      setError(errors("loadCollection"));
      setReady(true);
      return;
    }
    setCatalog(freshCatalog);
    setItems(collection.body.items);
    setError(null);
    setReady(true);
    // Collection chargée en ligne : les modifications en attente partent.
    void replayRef.current();
  }

  async function openSession(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await readJson<{ user?: AuthUser; error?: string }>(response);
    if (!response.ok || !result.user) throw new Error(result.error || errors("loginFailed"));
    rememberSession(result.user);
    await loadBoundData();
  }

  // Changement de compte (connexion, déconnexion, session expirée) : les données en cache et les pages
  // gardées par le routeur appartenaient à la session précédente.
  const router = useRouter();
  // L'utilisateur mémorisé donne déjà la clé : sa vérification réussie (même id) ne la change pas.
  const sessionKey = session === "unknown" ? null : session === "signed-in" ? (user?.id ?? "") : "";
  const previousSession = useRef<string | null>(null);
  useEffect(() => {
    if (sessionKey === null) return;
    if (previousSession.current !== null && previousSession.current !== sessionKey) {
      clearDataCache();
      // Session perdue sur l'accueil : sans cookie, le proxy y servirait la présentation des visiteurs au
      // lieu de l'écran de connexion du tableau de bord (RequireUser).
      const lostOnHome = sessionKey === "" && matchRoute(window.location.pathname)?.route === "/";
      if (!lostOnHome) router.refresh();
    }
    previousSession.current = sessionKey;
  }, [router, sessionKey]);

  // Compte connecté : données des autres écrans préchargées au repos.
  useEffect(() => {
    if (!sessionKey) return;
    return whenIdle(() => WARM_URLS.forEach(prefetchCached));
  }, [sessionKey]);

  // Session mémorisée reprise avant le premier affichage : navigation et cadre du compte tout de suite.
  // Lue après le montage seulement, pour que l'hydratation parte du même état que le rendu serveur.
  const rememberedUser = useRef<AuthUser | null>(null);
  // Requêtes lancées depuis le <head> (boot-requests) ; appliquées dès ce premier rendu si déjà arrivées.
  const bootRequests = useRef<BootRequests | null>(null);
  const bootApplied = useRef(false);
  useLayoutEffect(() => {
    const remembered = readSessionUser(browserStorage());
    rememberedUser.current = remembered;
    bootRequests.current ??= takeBootRequests();
    if (!remembered) return;
    // Session vérifiée et données déjà là : tableau de bord affiché directement, sans écran intermédiaire.
    const { collection, catalog: bootCatalog } = bootRequests.current?.done ?? {};
    if (collection?.status === 200 && collection.body?.user && collection.body.items && bootCatalog) {
      bootApplied.current = true;
      rememberSession(collection.body.user);
      setCatalog(bootCatalog);
      setItems(collection.body.items);
      setReady(true);
      return;
    }
    setUser(remembered);
    setSession("signed-in");
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Données du serveur arrivées (ou session refusée) : la copie gardée sur l'appareil ne s'affiche plus.
    let settled = false;
    let savedShown = false;
    async function load() {
      if (bootApplied.current) return;
      const remembered = rememberedUser.current;
      // Compte probablement connecté : le catalogue (public) part en même temps que la collection, et la
      // dernière copie gardée par le service worker s'affiche aussitôt, remplacée dès la réponse du serveur.
      // Les deux requêtes sont en général déjà parties depuis le <head> (boot-requests).
      const boot = bootRequests.current;
      const catalogRequest = boot?.catalog ?? (remembered ? requestCatalog() : undefined);
      catalogRequest?.catch(() => undefined);
      if (remembered) {
        void readSavedCollection(remembered.id).then((saved) => {
          if (!saved || settled || cancelled) return;
          savedShown = true;
          setCatalog(saved.catalog);
          setItems(saved.items);
          setReady(true);
        });
      }
      try {
        // Une seule requête vérifie la session et apporte la collection (401 : session absente ou expirée).
        let editsAtStart = edits.current;
        let collection = await (boot?.collection ?? requestCollection());
        if (cancelled) return;
        if (collection.status === 401) {
          settled = true;
          endSession();
          return;
        }
        if (!collection.body?.user || !collection.body.items) throw new Error("collection");
        rememberSession(collection.body.user);
        const freshCatalog = await (catalogRequest ?? requestCatalog());
        if (!freshCatalog) throw new Error("catalog");
        // Collection modifiée sur la copie gardée pendant le chargement : relue pour inclure ces modifications.
        if (edits.current !== editsAtStart) {
          editsAtStart = edits.current;
          collection = await requestCollection();
          if (!collection.body?.items) throw new Error("collection");
        }
        if (cancelled) return;
        settled = true;
        setCatalog(freshCatalog);
        if (collection.body?.items && edits.current === editsAtStart) setItems(collection.body.items);
        setError(null);
        setReady(true);
        void replayRef.current();
      } catch {
        // Erreur réseau ou serveur : le statut de session ne change pas. La copie gardée reste affichée ;
        // sans elle, seul le message d'erreur s'affiche.
        if (!cancelled) {
          settled = true;
          if (!savedShown) setError(errors("loadCollection"));
          setReady(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Nom de la carte visée par une opération, pour les messages d'échec. */
  function cardName(op: QueuedOp) {
    const printingId =
      op.kind === "save"
        ? op.payload.printingId
        : (serverItemsRef.current.find((item) => item.id === op.lineId) ?? itemsRef.current.find((item) => item.id === op.lineId))
            ?.printingId;
    const current = catalogRef.current;
    const printing = current?.printings.find((candidate) => candidate.id === printingId);
    if (!printing) return null;
    return printing.localizedName ?? current?.cards.find((card) => card.id === printing.cardId)?.name ?? null;
  }

  /** Modification gardée sur l'appareil, appliquée tout de suite à la collection affichée. */
  async function enqueue(userId: string, op: NewOp) {
    const next = await addOp(queueStore(), userId, op);
    setQueued({ userId, ops: next });
  }

  const replaying = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStep = useRef(0);

  async function sendOp(op: QueuedOp) {
    const { url, init } = requestFor(op);
    const response = await fetch(url, init);
    return { status: response.status, body: await response.json().catch(() => null) };
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
      const fresh = await requestCollection().catch(() => null);
      if (fresh?.body?.items && edits.current === editsAtStart && opsRef.current.length === 0) setItems(fresh.body.items);
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

  /**
   * Modification d'une ligne. Hors ligne, sans réseau, ou derrière d'autres modifications en attente, elle
   * part dans la file (l'ordre est gardé) au lieu d'échouer. « queued » : rien n'a été envoyé.
   */
  async function request(url: string, init: RequestInit, op: NewOp): Promise<"sent" | "queued"> {
    if (!user) throw new Error(errors("sessionExpired"));
    if (!navigator.onLine || opsRef.current.length > 0 || isTempId(op.lineId)) {
      await enqueue(user.id, op);
      void replay();
      return "queued";
    }
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch {
      // Erreur réseau : la modification attend le retour du réseau.
      await enqueue(user.id, op);
      return "queued";
    }
    const result = await readJson<MutationResult>(response);
    if (response.status === 401) {
      endSession();
      throw new Error(errors("sessionExpired"));
    }
    if (!response.ok) throw new Error(result.error || errors("saveFailed"));
    applyResult(result);
    return "sent";
  }

  const value = useMemo<CollectionContextValue>(
    () => ({
      session,
      ready,
      error,
      retry: () => {
        setError(null);
        setReady(false);
        // 401 : la session est close et l'écran de connexion s'affiche.
        loadBoundData().catch(() => undefined);
      },
      user,
      catalog,
      items,
      login: (email, password) =>
        openSession("/api/auth/login", {
          email,
          password,
          localUserId: window.localStorage.getItem(LOCAL_USER_KEY),
        }),
      register: (input) =>
        openSession("/api/auth/register", {
          ...input,
          localUserId: window.localStorage.getItem(LOCAL_USER_KEY),
        }),
      logout: async () => {
        // Cet appareil ne doit plus recevoir les alertes de ce compte.
        await disablePush();
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) throw new Error(errors("logoutFailed"));
        // Déconnexion voulue (confirmée par l'écran si la file n'est pas vide) : les modifications en attente sont perdues.
        if (user) await clearQueue(queueStore(), user.id).catch(() => undefined);
        endSession();
        setError(null);
      },
      deleteAccount: async () => {
        const response = await mutationFetch(
          "/api/auth/account",
          { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) },
          errors,
        );
        if (response.status === 401) {
          endSession();
          throw new Error(errors("sessionExpired"));
        }
        if (!response.ok) {
          const result = await readJson<{ error?: string }>(response).catch(() => ({ error: undefined }));
          throw new Error(result.error || errors("deleteAccountFailed"));
        }
        if (user) await clearQueue(queueStore(), user.id).catch(() => undefined);
        endSession();
        setError(null);
      },
      saveLine: async (input) => {
        // Ligne déjà affichée pour cette carte × état (comme la fusion faite par le serveur), sinon id temporaire.
        const existing = itemsRef.current.find(
          (item) => item.printingId === input.printingId && item.conditionCode === input.conditionCode,
        );
        await request(
          "/api/collection",
          { method: "POST", body: JSON.stringify(input) },
          { kind: "save", lineId: existing?.id ?? newTempId(), payload: input },
        );
      },
      saveBatch: async (input) => {
        if (!user) throw new Error(errors("sessionExpired"));
        const response = await mutationFetch(
          "/api/collection/bulk",
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
          errors,
        );
        const result = await readJson<{ items?: CollectionItemDTO[]; error?: string }>(response);
        if (response.status === 401) {
          endSession();
          throw new Error(errors("sessionExpired"));
        }
        if (!response.ok || !result.items) throw new Error(result.error || errors("addFailed"));
        editItems((current) => {
          const incoming = new Map(result.items?.map((item) => [item.id, item]) ?? []);
          return [...current.filter((item) => !incoming.has(item.id)), ...incoming.values()];
        });
      },
      importLines: async (input) => {
        if (!user) throw new Error(errors("sessionExpired"));
        const response = await mutationFetch(
          "/api/collection/import",
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
          errors,
        );
        const result = await readJson<ImportSummary & { items?: CollectionItemDTO[]; error?: string }>(response);
        if (response.status === 401) {
          endSession();
          throw new Error(errors("sessionExpired"));
        }
        if (!response.ok || !result.items) throw new Error(result.error || errors("importFailed"));
        editItems(() => result.items ?? []);
        return { created: result.created, updated: result.updated, skipped: result.skipped };
      },
      patchLine: async (id, input) => {
        // Mise à jour optimiste : l'interface reflète la modification sans attendre le serveur.
        // Un changement d'état peut fusionner deux lignes, on laisse alors le serveur trancher.
        // Copie du serveur seulement : une ligne créée hors ligne n'existe que dans la file.
        const previous = serverItemsRef.current.find((item) => item.id === id);
        const optimistic = previous && input.conditionCode === undefined;
        if (optimistic) {
          editItems((current) =>
            input.quantity != null && input.quantity <= 0
              ? current.filter((item) => item.id !== id)
              : current.map((item) => (item.id === id ? { ...item, ...input } : item)),
          );
        }
        const restore = () => {
          if (optimistic) editItems((current) => [...current.filter((item) => item.id !== id), previous]);
        };
        try {
          const sent = await request(
            `/api/collection/${id}`,
            { method: "PATCH", body: JSON.stringify(input) },
            { kind: "patch", lineId: id, payload: input },
          );
          // En file : la modification s'affiche par la file, la copie du serveur reste celle du serveur.
          if (sent === "queued") restore();
        } catch (error) {
          restore();
          throw error;
        }
      },
      deleteLine: async (id) => {
        await request(`/api/collection/${id}`, { method: "DELETE" }, { kind: "delete", lineId: id, payload: null });
      },
      pendingCount: ops.length,
      pendingIds,
      syncing,
      syncErrors,
      dismissSyncError: (id) => setSyncErrors((list) => list.filter((entry) => entry.id !== id)),
    }),
    // Les fonctions ferment sur user ; session, ready, catalog et items sont l'état public.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, ready, error, user, catalog, items, ops, pendingIds, syncing, syncErrors, errors],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
