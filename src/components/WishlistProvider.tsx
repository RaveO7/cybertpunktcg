"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useCollection, whenIdle } from "@/components/CollectionProvider";
import { fetchCached } from "@/components/data-cache";
import { api } from "@/lib/client/api";
import { useTranslatedRequest } from "@/lib/client/use-api-error-message";
import type { WishlistItemDTO } from "@/lib/types";

type WishInput = { targetPrice?: string | null; notes?: string | null };

type WishlistContextValue = {
  ready: boolean;
  /** Chargement de la liste échoué (la liste affichée serait fausse). */
  error: boolean;
  retry: () => void;
  items: WishlistItemDTO[];
  /** Alertes de prix pas encore vues (badge de navigation). */
  unseenAlerts: number;
  save: (printingId: string, input?: WishInput) => Promise<void>;
  /** Ajout groupé, tout ou rien ; les tirages déjà présents restent tels quels. */
  addMany: (printingIds: string[]) => Promise<{ added: number; alreadyPresent: number }>;
  patch: (id: string, input: WishInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  acknowledge: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist doit être utilisé dans le provider.");
  return value;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCollection();
  const userId = user?.id ?? null;
  const translated = useTranslatedRequest();
  const [items, setItems] = useState<WishlistItemDTO[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Incrémenté par `retry` : relance le chargement après un échec.
  const [attempt, setAttempt] = useState(0);

  // Changement de compte : la liste précédente ne doit plus s'afficher.
  const [syncedUser, setSyncedUser] = useState(userId);
  if (syncedUser !== userId) {
    setSyncedUser(userId);
    setItems([]);
    setLoadedFor(null);
    setFailed(false);
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // Liste secondaire : chargée au repos, pour ne pas ralentir le premier affichage de l'app.
    const load = async () => {
      try {
        const body = await fetchCached("/api/wishlist", { schema: "wishlistSchema" });
        if (!cancelled) {
          setItems(body.items);
          setFailed(false);
        }
      } catch {
        // La liste de souhaits est secondaire : la collection reste utilisable, seul son écran signale l'échec.
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoadedFor(userId);
      }
    };
    const cancelIdle = whenIdle(() => void load());
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [userId, attempt]);

  const value = useMemo<WishlistContextValue>(() => {
    const upsert = (item: WishlistItemDTO) =>
      setItems((current) =>
        current.some((entry) => entry.id === item.id)
          ? current.map((entry) => (entry.id === item.id ? item : entry))
          : [...current, item],
      );
    return {
      ready: Boolean(userId) && loadedFor === userId,
      error: failed,
      retry: () => {
        setFailed(false);
        setLoadedFor(null);
        setAttempt((current) => current + 1);
      },
      items,
      unseenAlerts: items.filter((item) => item.alertAt && !item.alertSeen).length,
      save: async (printingId, input = {}) => {
        const { item } = await translated(api("/api/wishlist", { body: { printingId, ...input }, schema: "wishlistItemResponseSchema" }));
        upsert(item);
      },
      addMany: async (printingIds) => {
        const { added, alreadyPresent, items: saved } = await translated(
          api("/api/wishlist/bulk", { body: { printingIds }, schema: "wishlistBulkSchema" }),
        );
        const byId = new Map(saved.map((item) => [item.id, item]));
        setItems((current) => [
          ...current.map((entry) => byId.get(entry.id) ?? entry),
          ...saved.filter((item) => !current.some((entry) => entry.id === item.id)),
        ]);
        return { added, alreadyPresent };
      },
      patch: async (id, input) => {
        const { item } = await translated(api(`/api/wishlist/${id}`, { method: "PATCH", body: input, schema: "wishlistItemResponseSchema" }));
        upsert(item);
      },
      remove: async (id) => {
        await translated(api(`/api/wishlist/${id}`, { method: "DELETE" }));
        setItems((current) => current.filter((entry) => entry.id !== id));
      },
      acknowledge: async () => {
        if (!items.some((item) => item.alertAt && !item.alertSeen)) return;
        setItems((current) => current.map((item) => (item.alertSeen ? item : { ...item, alertSeen: true })));
        // Échec sans conséquence : les alertes restent « non vues » sur le serveur et seront marquées à la prochaine visite.
        await api("/api/wishlist/seen", { method: "POST" }).catch(() => undefined);
      },
    };
  }, [items, loadedFor, failed, userId, translated]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
