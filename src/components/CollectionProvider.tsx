"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser, CatalogDTO, CollectionItemDTO } from "@/lib/types";

const LOCAL_USER_KEY = "cptcg-user-id";

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
  ready: boolean;
  error: string | null;
  user: AuthUser | null;
  catalog: CatalogDTO | null;
  items: CollectionItemDTO[];
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  saveLine: (input: SaveInput) => Promise<void>;
  saveBatch: (input: {
    conditionCode: string;
    lines: { printingId: string; quantity: number }[];
  }) => Promise<void>;
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
  const [catalog, setCatalog] = useState<CatalogDTO | null>(null);
  const [items, setItems] = useState<CollectionItemDTO[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

  async function loadBoundData() {
    const [catalogResponse, collectionResponse] = await Promise.all([
      fetch("/api/catalog", { cache: "no-store" }),
      fetch("/api/collection", { cache: "no-store" }),
    ]);
    if (catalogResponse.status === 401 || collectionResponse.status === 401) {
      setUser(null);
      setCatalog(null);
      setItems([]);
      setReady(true);
      throw new Error("La session n'a pas été conservée. Réessayez.");
    }
    if (!catalogResponse.ok || !collectionResponse.ok) {
      setError("Impossible de charger la collection.");
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
    if (!response.ok || !result.user) throw new Error(result.error || "Connexion impossible.");
    window.localStorage.removeItem(LOCAL_USER_KEY);
    setUser(result.user);
    await loadBoundData();
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        if (sessionResponse.status === 401) {
          setUser(null);
          setReady(true);
          return;
        }
        const session = await readJson<{ user?: AuthUser }>(sessionResponse);
        if (!sessionResponse.ok || !session.user) throw new Error("session");
        window.localStorage.removeItem(LOCAL_USER_KEY);
        setUser(session.user);
        await loadBoundData();
      } catch {
        if (!cancelled) {
          setError("Impossible de charger la collection.");
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
    if (!user) throw new Error("Session absente.");
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const result = await readJson<MutationResult>(response);
    if (response.status === 401) {
      setUser(null);
      setItems([]);
      setCatalog(null);
      throw new Error("Session expirée. Reconnectez-vous.");
    }
    if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
    applyResult(result);
  }

  const value = useMemo<CollectionContextValue>(
    () => ({
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
        if (!response.ok) throw new Error("Déconnexion impossible.");
        setUser(null);
        setItems([]);
        setCatalog(null);
        setError(null);
        setReady(true);
      },
      saveLine: (input) => request("/api/collection", { method: "POST", body: JSON.stringify(input) }),
      saveBatch: async (input) => {
        if (!user) throw new Error("Session absente.");
        const response = await fetch("/api/collection/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const result = await readJson<{ items?: CollectionItemDTO[]; error?: string }>(response);
        if (response.status === 401) {
          setUser(null);
          setItems([]);
          setCatalog(null);
          throw new Error("Session expirée. Reconnectez-vous.");
        }
        if (!response.ok || !result.items) throw new Error(result.error || "Ajout impossible.");
        setItems((current) => {
          const incoming = new Map(result.items?.map((item) => [item.id, item]) ?? []);
          return [...current.filter((item) => !incoming.has(item.id)), ...incoming.values()];
        });
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
    // Les fonctions ferment sur user ; ready, catalog et items sont l'état public.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, error, user, catalog, items],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
