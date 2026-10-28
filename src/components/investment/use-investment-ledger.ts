"use client";

import { useCallback, useEffect, useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { fetchCached, readCached, useCachedJson } from "@/components/data-cache";
import { sendJson, useRequestErrors } from "@/components/send-json";
import type { ExchangeRates } from "@/lib/logic";
import type { CollectionItemDTO, SaleDTO, SellAlertDTO } from "@/lib/types";

// Données propres à la page Investissement, en plus de la collection : ventes, alertes de revente et taux
// de change. Gardées dans le cache des écrans (data-cache) : un retour sur la page les affiche aussitôt.

const SALES_URL = "/api/investment/sales";
const ALERTS_URL = "/api/investment/sell-alerts";
const RATES_URL = "/api/investment/rates";

/** Vente à enregistrer : prix de vente total et frais en texte (« 12,50 » accepté), date « AAAA-MM-JJ ». */
export type SaleInput = { salePrice: string; saleCurrency: string; fees: string; soldAt: string };

type SaleMutation = { sale: SaleDTO; item: CollectionItemDTO | null; deletedId: string | null };

/** Ventes du compte, et les actions qui les modifient (la collection affichée suit). */
export function useSales(enabled: boolean) {
  const { applyMutation } = useCollection();
  const errors = useRequestErrors();
  const { data, error, mutate, retry } = useCachedJson<{ sales: SaleDTO[] }>(enabled ? SALES_URL : null);

  const sell = useCallback(
    async (itemId: string, quantity: number, input: SaleInput) => {
      const result = await sendJson<SaleMutation>(
        SALES_URL,
        { method: "POST", body: JSON.stringify({ itemId, quantity, ...input }) },
        errors,
      );
      applyMutation({ item: result.item, deletedId: result.deletedId });
      mutate((current) => ({ sales: [result.sale, ...(current?.sales ?? [])] }));
    },
    [applyMutation, errors, mutate],
  );

  const update = useCallback(
    async (id: string, input: SaleInput) => {
      const { sale } = await sendJson<{ sale: SaleDTO }>(
        `${SALES_URL}/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
        errors,
      );
      mutate((current) => ({ sales: (current?.sales ?? []).map((entry) => (entry.id === id ? sale : entry)) }));
    },
    [errors, mutate],
  );

  /** Annule la vente : ses exemplaires reviennent dans la collection. */
  const undo = useCallback(
    async (id: string) => {
      const result = await sendJson<{ deletedSaleId: string; item: CollectionItemDTO | null }>(
        `${SALES_URL}/${id}`,
        { method: "DELETE" },
        errors,
      );
      applyMutation({ item: result.item, deletedId: null });
      mutate((current) => ({ sales: (current?.sales ?? []).filter((entry) => entry.id !== result.deletedSaleId) }));
    },
    [applyMutation, errors, mutate],
  );

  return { sales: data?.sales ?? null, error, retry, sell, update, undo };
}

/** Alertes de revente du compte. */
export function useSellAlerts(enabled: boolean) {
  const errors = useRequestErrors();
  const { data, mutate } = useCachedJson<{ alerts: SellAlertDTO[] }>(enabled ? ALERTS_URL : null);

  const save = useCallback(
    async (printingId: string, targetPrice: string) => {
      const { alert } = await sendJson<{ alert: SellAlertDTO }>(
        ALERTS_URL,
        { method: "POST", body: JSON.stringify({ printingId, targetPrice }) },
        errors,
      );
      mutate((current) => ({
        alerts: [...(current?.alerts ?? []).filter((entry) => entry.printingId !== printingId), alert],
      }));
    },
    [errors, mutate],
  );

  const remove = useCallback(
    async (id: string) => {
      await sendJson(`${ALERTS_URL}/${id}`, { method: "DELETE" }, errors);
      mutate((current) => ({ alerts: (current?.alerts ?? []).filter((entry) => entry.id !== id) }));
    },
    [errors, mutate],
  );

  /** Alertes atteintes vues : elles ne sont plus signalées comme nouvelles. */
  const acknowledge = useCallback(async () => {
    await sendJson(`${ALERTS_URL}/seen`, { method: "POST" }, errors);
    mutate((current) => ({ alerts: (current?.alerts ?? []).map((entry) => ({ ...entry, alertSeen: true })) }));
  }, [errors, mutate]);

  return { alerts: data?.alerts ?? null, save, remove, acknowledge };
}

const NO_RATES: ExchangeRates = {};

/**
 * Taux BCE des clés « devise:jour » demandées (voir investmentRateKeys). Pendant le chargement d'une
 * nouvelle liste, les taux précédents restent affichés ; sans aucun taux, les achats en devise restent
 * signalés comme non convertis.
 */
export function useExchangeRates(keys: string[]) {
  const keysKey = keys.join(",");
  const body = keysKey ? JSON.stringify({ keys: keysKey.split(",") }) : null;
  // Dernière réponse reçue : affichée tant que celle de la liste courante n'est pas en cache.
  const [fetched, setFetched] = useState<ExchangeRates | null>(null);

  useEffect(() => {
    if (!body) return;
    let cancelled = false;
    fetchCached<{ rates?: ExchangeRates }>(RATES_URL, body)
      .then((result) => {
        if (!cancelled) setFetched(result.rates ?? {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [body]);

  if (!body) return NO_RATES;
  return readCached<{ rates?: ExchangeRates }>(RATES_URL, body)?.rates ?? fetched ?? NO_RATES;
}
