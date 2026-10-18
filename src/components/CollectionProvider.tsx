"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clearDataCache, prefetchCached } from "@/components/data-cache";
import { mutationFetch, useRequestErrors } from "@/components/send-json";
import type { ImportLine } from "@/lib/collection-csv";
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

function whenIdle(task: () => void) {
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
  const [items, setItems] = useState<CollectionItemDTO[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const errors = useRequestErrors();

  function applyResult(result: MutationResult) {
    setItems((current) => {
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

  async function loadBoundData(catalogRequest?: Promise<Response>) {
    const [catalogResponse, collectionResponse] = await Promise.all([
      catalogRequest ?? fetch("/api/catalog", { cache: "no-store" }),
      fetch("/api/collection", { cache: "no-store" }),
    ]);
    if (catalogResponse.status === 401 || collectionResponse.status === 401) {
      endSession();
      throw new Error(errors("sessionLost"));
    }
    if (!catalogResponse.ok || !collectionResponse.ok) {
      setError(errors("loadCollection"));
      setReady(true);
      return;
    }
    const catalogJson = await readJson<CatalogDTO>(catalogResponse);
    const collectionJson = await readJson<{ items: CollectionItemDTO[] }>(collectionResponse);
    setCatalog(catalogJson);
    setItems(collectionJson.items);
    setError(null);
    setReady(true);
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
      router.refresh();
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
  useLayoutEffect(() => {
    const remembered = readSessionUser(browserStorage());
    rememberedUser.current = remembered;
    if (!remembered) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(remembered);
    setSession("signed-in");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Compte probablement connecté : le catalogue (public) part en même temps que la session.
      const catalogRequest = rememberedUser.current ? fetch("/api/catalog", { cache: "no-store" }) : undefined;
      catalogRequest?.catch(() => undefined);
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        if (sessionResponse.status === 401) {
          endSession();
          return;
        }
        const verified = await readJson<{ user?: AuthUser }>(sessionResponse);
        if (!sessionResponse.ok || !verified.user) throw new Error("session");
        rememberSession(verified.user);
        await loadBoundData(catalogRequest);
      } catch {
        // Erreur réseau ou serveur : le statut de session ne change pas, seul le message d'erreur s'affiche.
        if (!cancelled) {
          setError(errors("loadCollection"));
          setReady(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function request(url: string, init: RequestInit) {
    if (!user) throw new Error(errors("sessionExpired"));
    const response = await mutationFetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    }, errors);
    const result = await readJson<MutationResult>(response);
    if (response.status === 401) {
      endSession();
      throw new Error(errors("sessionExpired"));
    }
    if (!response.ok) throw new Error(result.error || errors("saveFailed"));
    applyResult(result);
  }

  const value = useMemo<CollectionContextValue>(
    () => ({
      session,
      ready,
      error,
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
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) throw new Error(errors("logoutFailed"));
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
        endSession();
        setError(null);
      },
      saveLine: (input) => request("/api/collection", { method: "POST", body: JSON.stringify(input) }),
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
        setItems((current) => {
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
        setItems(result.items);
        return { created: result.created, updated: result.updated, skipped: result.skipped };
      },
      patchLine: async (id, input) => {
        // Mise à jour optimiste : l'interface reflète la modification sans attendre le serveur.
        // Un changement d'état peut fusionner deux lignes, on laisse alors le serveur trancher.
        const previous = itemsRef.current.find((item) => item.id === id);
        const optimistic = previous && input.conditionCode === undefined;
        if (optimistic) {
          setItems((current) =>
            input.quantity != null && input.quantity <= 0
              ? current.filter((item) => item.id !== id)
              : current.map((item) => (item.id === id ? { ...item, ...input } : item)),
          );
        }
        try {
          await request(`/api/collection/${id}`, { method: "PATCH", body: JSON.stringify(input) });
        } catch (error) {
          if (optimistic) {
            setItems((current) => [...current.filter((item) => item.id !== id), previous]);
          }
          throw error;
        }
      },
      deleteLine: (id) => request(`/api/collection/${id}`, { method: "DELETE" }),
    }),
    // Les fonctions ferment sur user ; session, ready, catalog et items sont l'état public.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, ready, error, user, catalog, items, errors],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
