"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { useCachedJson } from "@/components/data-cache";
import { sendJson, useRequestErrors } from "@/components/send-json";
import { compareDeckLines, extensionsByCard, isDeckCard, type DeckEntry } from "@/lib/deck-rules";
import type { CardDTO, CatalogDTO, DeckDTO, PrintingDTO } from "@/lib/types";

type DeckPatch = { name?: string; cards?: DeckEntry[] };

const DECKS_URL = "/api/decks";
const NO_DECKS: DeckDTO[] = [];

/** Decks du compte : copie en cache affichée aussitôt, rechargés à chaque visite, mis à jour localement. */
export function useDecks() {
  const { user } = useCollection();
  const errors = useRequestErrors();
  const { data, error, mutate, retry } = useCachedJson<{ decks: DeckDTO[] }>(user ? DECKS_URL : null);
  const decks = data?.decks ?? NO_DECKS;
  const setDecks = useCallback(
    (update: (current: DeckDTO[]) => DeckDTO[]) => mutate((current) => ({ decks: update(current?.decks ?? []) })),
    [mutate],
  );

  const replace = useCallback(
    (deck: DeckDTO) => setDecks((current) => [deck, ...current.filter((entry) => entry.id !== deck.id)]),
    [setDecks],
  );

  return {
    ready: Boolean(user) && data !== undefined,
    error: error ? errors("loadDecks") : null,
    retry,
    decks,
    replace,
    create: async (input: { name?: string; cards?: DeckEntry[] }) => {
      const { deck } = await sendJson<{ deck: DeckDTO }>("/api/decks", { method: "POST", body: JSON.stringify(input) }, errors);
      replace(deck);
      return deck;
    },
    remove: async (id: string) => {
      await sendJson(`/api/decks/${id}`, { method: "DELETE" }, errors);
      setDecks((current) => current.filter((deck) => deck.id !== id));
    },
  };
}

/** Index du catalogue utiles aux decks (calculés une fois par catalogue). */
export function useDeckCatalog(catalog: CatalogDTO | null) {
  return useMemo(() => {
    const cardsById = new Map<string, CardDTO>();
    const printingsByCard = new Map<string, PrintingDTO[]>();
    const preview = new Map<string, PrintingDTO>();
    const extensions = new Map<string, Set<string>>();
    if (!catalog) return { cardsById, printingsByCard, preview, extensions, pool: [] as CardDTO[] };
    for (const card of catalog.cards) cardsById.set(card.id, card);
    for (const printing of catalog.printings) {
      printingsByCard.set(printing.cardId, [...(printingsByCard.get(printing.cardId) ?? []), printing]);
      // Visuel : un tirage anglais avec image de préférence.
      const current = preview.get(printing.cardId);
      const better =
        printing.imagePath && (!current?.imagePath || (current.language !== "en" && printing.language === "en"));
      if (!current || better) preview.set(printing.cardId, printing);
    }
    const pool = catalog.cards.filter(isDeckCard).sort((a, b) => compareDeckLines({ card: a, quantity: 1 }, { card: b, quantity: 1 }));
    return { cardsById, printingsByCard, preview, extensions: extensionsByCard(catalog.printings), pool };
  }, [catalog]);
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Enregistrement automatique : les modifications sont regroupées (600 ms), une seule requête
 * à la fois, et la dernière version part même si l'on quitte la page entre-temps.
 */
export function useDeckSaver(deckId: string, onSaved: (deck: DeckDTO) => void) {
  const errors = useRequestErrors();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<DeckPatch | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Les modifications arrivées pendant une requête partent juste après.
      while (pending.current) {
        const body: DeckPatch = pending.current;
        pending.current = null;
        setStatus("saving");
        try {
          const { deck } = await sendJson<{ deck: DeckDTO }>(
            `/api/decks/${deckId}`,
            { method: "PATCH", body: JSON.stringify(body) },
            errors,
          );
          onSavedRef.current(deck);
          setError(null);
          setStatus("saved");
        } catch (reason) {
          // On garde la modification pour « Réessayer », fusionnée avec les plus récentes.
          pending.current = { ...body, ...(pending.current ?? {}) };
          setError(reason instanceof Error ? reason.message : null);
          setStatus("error");
          return;
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [deckId, errors]);

  const queue = useCallback(
    (patch: DeckPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current && !inFlight.current) {
        void fetch(`/api/decks/${deckId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(pending.current),
          keepalive: true,
        }).catch(() => undefined);
      }
    },
    [deckId],
  );

  // Onglet fermé, rechargé ou appli mise en arrière-plan (mobile) : le délai de 600 ms n'aurait
  // pas le temps d'expirer, la modification en attente part tout de suite (keepalive : la requête
  // survit à la fermeture de la page).
  useEffect(() => {
    const sendNow = () => {
      if (!pending.current || inFlight.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const body: DeckPatch = pending.current;
      pending.current = null;
      inFlight.current = true;
      fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const { deck } = (await response.json()) as { deck: DeckDTO };
          onSavedRef.current(deck);
          setError(null);
          setStatus("saved");
          inFlight.current = false;
          // Modifications faites entre-temps (retour sur l'appli) : enregistrement normal.
          if (pending.current) void flush();
        })
        .catch(() => {
          // La page est restée ouverte (simple passage en arrière-plan) : on garde la modification
          // et la file normale la renvoie (bouton « Réessayer » si le serveur la refuse encore).
          inFlight.current = false;
          pending.current = { ...body, ...(pending.current ?? {}) };
          void flush();
        });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendNow();
    };
    window.addEventListener("pagehide", sendNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", sendNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deckId, flush]);

  return { status, error, queue, retry: flush };
}
