"use client";

import { useEffect, useState } from "react";
import type { ChartPoint } from "@/components/PriceChart";
import { fetchCached, readCached } from "@/components/data-cache";
import { CHART_RANGE_DAYS, type ChartRange } from "@/components/investment/chart-range";
import type { CatalogDTO, CollectionItemDTO } from "@/lib/types";

/** Collection chargée : rien n'est demandé avant, et toute modification de la collection recharge. */
type CollectionState = { ready: boolean; catalog: CatalogDTO | null; items: CollectionItemDTO[] };

/** Achat daté, placé sur la courbe. */
export type HistoryPurchase = {
  day: string;
  printingId: string;
  quantity: number;
  unitPrice: number | null;
  currency: string | null;
};

type HistoryBody = {
  points?: { day: string; marketTotal: number; invested?: number; profit?: number | null }[];
  purchases?: HistoryPurchase[];
};

type ReferenceBody = { day?: string | null; prices?: Record<string, number> };

/** Prix de chaque carte au début d'une durée, dont le premier jour est compté côté serveur. */
export type PeriodReference = { range: ChartRange; day: string | null; prices: Record<string, number> };

export type ChartStatus = "loading" | "ready" | "error";

// Courbe d'une liste d'exemplaires (recherche, sélection) : une seule requête une fois la saisie posée.
const ITEMS_HISTORY_DELAY_MS = 250;

/** Historique de la valeur : points de la courbe et achats datés. */
export function useInvestmentHistory({
  ready,
  catalog,
  items,
  set,
  language,
  itemsKey,
}: CollectionState & {
  set: string;
  language: string;
  /** Exemplaires de la courbe (ids triés, séparés par des virgules) ; null : extension et langue seules. */
  itemsKey: string | null;
}) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [purchases, setPurchases] = useState<HistoryPurchase[]>([]);
  const [status, setStatus] = useState<ChartStatus>("loading");
  // Après le premier chargement, le graphique reste affiché pendant les rechargements (pas de saut de mise en page).
  const [loaded, setLoaded] = useState(false);
  // Incrémenté par « Réessayer » : relance le chargement.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !catalog) return;
    let cancelled = false;
    async function loadHistory() {
      const itemIds = itemsKey == null ? null : itemsKey.split(",").filter(Boolean);
      const params = new URLSearchParams();
      if (set && set !== "all") params.set("set", set);
      if (language) params.set("language", language);
      // Liste d'exemplaires : envoyée en POST, trop longue pour l'URL.
      const url = itemIds ? "/api/investment/history" : `/api/investment/history?${params}`;
      const requestBody = itemIds ? JSON.stringify({ items: itemIds }) : undefined;
      const show = (body: HistoryBody) => {
        setPoints(
          (body.points ?? []).map((point) => ({
            day: point.day,
            value: point.marketTotal,
            invested: point.invested ?? null,
            profit: point.profit ?? null,
          })),
        );
        setPurchases(body.purchases ?? []);
        setStatus("ready");
        setLoaded(true);
      };
      // Aucun exemplaire retenu par la recherche ou la performance : courbe vide, sans requête.
      if (itemIds?.length === 0) return show({});
      // Dernière courbe connue pour ces filtres affichée aussitôt, puis mise à jour.
      const cached = readCached<HistoryBody>(url, requestBody);
      if (cached) show(cached);
      else setStatus("loading");
      if (itemIds) {
        await new Promise((resolve) => setTimeout(resolve, ITEMS_HISTORY_DELAY_MS));
        if (cancelled) return;
      }
      try {
        const body = await fetchCached<HistoryBody>(url, requestBody);
        if (!cancelled) show(body);
      } catch {
        if (!cancelled && !cached) {
          setPoints([]);
          setPurchases([]);
          setStatus("error");
        }
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [attempt, catalog, items, itemsKey, language, ready, set]);

  return {
    points,
    purchases,
    status,
    loaded,
    retry() {
      setStatus("loading");
      setAttempt((current) => current + 1);
    },
  };
}

/** Prix de référence de la durée, indépendants de la courbe : son premier jour est compté côté serveur. */
export function usePeriodReference({ ready, catalog, items, range }: CollectionState & { range: ChartRange }) {
  const [reference, setReference] = useState<PeriodReference | null>(null);
  // Durée dont les prix de référence n'ont pas pu être chargés.
  const [error, setError] = useState<ChartRange | null>(null);
  // Incrémenté par « Réessayer » : relance le chargement.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !catalog) return;
    let cancelled = false;
    async function loadReference() {
      const days = CHART_RANGE_DAYS[range];
      const url = `/api/investment/history?${new URLSearchParams({ referenceDays: days == null ? "" : String(days) })}`;
      const show = (body: ReferenceBody) => {
        setReference({ range, day: body.day ?? null, prices: body.prices ?? {} });
        setError(null);
      };
      const cached = readCached<ReferenceBody>(url);
      if (cached) show(cached);
      try {
        const body = await fetchCached<ReferenceBody>(url);
        if (!cancelled) show(body);
      } catch {
        if (!cancelled && !cached) setError(range);
      }
    }
    void loadReference();
    return () => {
      cancelled = true;
    };
  }, [attempt, catalog, items, range, ready]);

  return {
    /**
     * Prix de la durée choisie ; null tant qu'ils manquent (chargement, échec) : pas de variation,
     * plutôt que celle d'une autre durée.
     */
    reference: reference?.range === range ? reference : null,
    /** Prix de début de période introuvables : les variations du marché ne sont pas affichées. */
    error: error === range,
    retry() {
      setError(null);
      setAttempt((current) => current + 1);
    },
  };
}
