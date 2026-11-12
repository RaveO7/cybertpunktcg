"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { requestCatalog } from "@/lib/boot-requests";
import { ApiError, api } from "@/lib/client/api";
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
        // Catalogue : gros et versionné, lu sans schéma (cf. src/lib/api-responses.ts).
        const [shared, catalog] = await Promise.all([
          api(`/api/share/${encodeURIComponent(token)}`, { schema: "sharedBinderSchema", cache: "no-store" }),
          requestCatalog(),
        ]);
        if (cancelled) return;
        if (!catalog) throw new Error("catalog");
        setData({ ownerName: shared.owner.displayName, items: shared.items, catalog, token });
        setReady(true);
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof ApiError && caught.status === 404 ? "not_found" : "load_failed");
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
