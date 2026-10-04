"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CatalogDTO, CollectionItemDTO } from "@/lib/types";

export type SharedBinderData = {
  ownerName: string;
  items: CollectionItemDTO[];
  catalog: CatalogDTO;
  token: string;
};

type SharedBinderContextValue = {
  ready: boolean;
  error: string | null;
  data: SharedBinderData | null;
};

const SharedBinderContext = createContext<SharedBinderContextValue | null>(null);

export function useSharedBinder() {
  const value = useContext(SharedBinderContext);
  if (!value) throw new Error("useSharedBinder must be used within SharedBinderProvider");
  return value;
}

export function SharedBinderProvider({ token, children }: { token: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedBinderData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setReady(false);
      setError(null);
      try {
        const [shareResponse, catalogResponse] = await Promise.all([
          fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" }),
          fetch("/api/catalog", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (shareResponse.status === 404) {
          setData(null);
          setError("not_found");
          setReady(true);
          return;
        }
        if (!shareResponse.ok || !catalogResponse.ok) {
          setData(null);
          setError("load_failed");
          setReady(true);
          return;
        }
        const shareJson = (await shareResponse.json()) as {
          owner: { displayName: string };
          items: CollectionItemDTO[];
        };
        const catalogJson = (await catalogResponse.json()) as CatalogDTO;
        setData({
          ownerName: shareJson.owner.displayName,
          items: shareJson.items,
          catalog: catalogJson,
          token,
        });
        setReady(true);
      } catch {
        if (!cancelled) {
          setData(null);
          setError("load_failed");
          setReady(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <SharedBinderContext.Provider value={{ ready, error, data }}>{children}</SharedBinderContext.Provider>
  );
}
