"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { sendJson, useRequestErrors } from "@/components/send-json";
import type { WishlistItemDTO } from "@/lib/types";

type WishInput = { targetPrice?: string | null; notes?: string | null };

type WishlistContextValue = {
  ready: boolean;
  items: WishlistItemDTO[];
  /** Alertes de prix pas encore vues (badge de navigation). */
  unseenAlerts: number;
  save: (printingId: string, input?: WishInput) => Promise<void>;
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
  const errors = useRequestErrors();
  const [items, setItems] = useState<WishlistItemDTO[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Changement de compte : la liste précédente ne doit plus s'afficher.
  const [syncedUser, setSyncedUser] = useState(userId);
  if (syncedUser !== userId) {
    setSyncedUser(userId);
    setItems([]);
    setLoadedFor(null);
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/wishlist", { cache: "no-store" });
        if (!response.ok) throw new Error("wishlist");
        const body = (await response.json()) as { items: WishlistItemDTO[] };
        if (!cancelled) setItems(body.items);
      } catch {
        // La liste de souhaits est secondaire : la collection reste utilisable.
      } finally {
        if (!cancelled) setLoadedFor(userId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<WishlistContextValue>(() => {
    const upsert = (item: WishlistItemDTO) =>
      setItems((current) =>
        current.some((entry) => entry.id === item.id)
          ? current.map((entry) => (entry.id === item.id ? item : entry))
          : [...current, item],
      );
    return {
      ready: Boolean(userId) && loadedFor === userId,
      items,
      unseenAlerts: items.filter((item) => item.alertAt && !item.alertSeen).length,
      save: async (printingId, input = {}) => {
        const { item } = await sendJson<{ item: WishlistItemDTO }>(
          "/api/wishlist",
          { method: "POST", body: JSON.stringify({ printingId, ...input }) },
          errors,
        );
        upsert(item);
      },
      patch: async (id, input) => {
        const { item } = await sendJson<{ item: WishlistItemDTO }>(
          `/api/wishlist/${id}`,
          { method: "PATCH", body: JSON.stringify(input) },
          errors,
        );
        upsert(item);
      },
      remove: async (id) => {
        await sendJson(`/api/wishlist/${id}`, { method: "DELETE" }, errors);
        setItems((current) => current.filter((entry) => entry.id !== id));
      },
      acknowledge: async () => {
        if (!items.some((item) => item.alertAt && !item.alertSeen)) return;
        setItems((current) => current.map((item) => (item.alertSeen ? item : { ...item, alertSeen: true })));
        await sendJson("/api/wishlist/seen", { method: "POST" }, errors).catch(() => undefined);
      },
    };
  }, [items, loadedFor, userId, errors]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
