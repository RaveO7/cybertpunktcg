"use client";

// Hooks client des tournois : sondage de l'état (révision + correction d'horloge), heure
// serveur pour le chrono, et file d'actions de l'organisateur (hors connexion comprise).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ApiError, api } from "@/lib/client/api";
import { useApiErrorMessage } from "@/lib/client/use-api-error-message";
import type { CommandResult } from "@/lib/tournament/commands";
import { clockOffsetMs } from "@/lib/tournament/clock";
import {
  browserStorage,
  createOfflineQueue,
  type QueuedCommand,
  type SendOutcome,
} from "@/lib/tournament/offline-queue";
import type { TournamentView } from "@/lib/tournament/view";

export const POLL_INTERVAL_MS = 5000;

/** Message d'un échec sur les écrans de tournoi : leur propre message « hors ligne », « Échec » par défaut. */
export function useTournamentErrorMessage() {
  const t = useTranslations("tournaments");
  const message = useApiErrorMessage({ offline: t("offline") });
  return useCallback((error: unknown) => message(error, t("failed")), [message, t]);
}

type StateError = "notFound" | "failed" | null;

/** État d'un tournoi, rafraîchi toutes les 5 s quand la page est visible. */
export function useTournamentState(tournamentId: string | null) {
  const [view, setView] = useState<TournamentView | null>(null);
  const [error, setError] = useState<StateError>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const revision = useRef<number | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!tournamentId) return;
      const known = !force && revision.current !== null ? `?rev=${revision.current}` : "";
      const sentAt = Date.now();
      try {
        // Sondage : chaque requête doit réellement partir (pas de cache), elle mesure aussi l'horloge.
        const body = await api(`/api/tournaments/${tournamentId}/state${known}`, { schema: "tournamentStateSchema", cache: "no-store" });
        const receivedAt = Date.now();
        setOffsetMs(clockOffsetMs(Date.parse(body.serverNow), sentAt, receivedAt));
        if (!("unchanged" in body)) {
          revision.current = body.revision;
          setView(body);
        }
        setError(null);
      } catch (error) {
        // On garde la dernière vue connue : l'écran reste utilisable sans réseau.
        setError(error instanceof ApiError && error.status === 404 ? "notFound" : "failed");
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    // Premier chargement au tick suivant : l'effet ne fait que s'abonner.
    const first = window.setTimeout(() => void load(true), 0);
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { view, error, offsetMs, refresh };
}

/** Heure du serveur (horloge du téléphone corrigée), mise à jour chaque seconde. */
export function useServerNow(offsetMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return new Date(now + offsetMs);
}

export type ActionOutcome =
  | { status: "ok"; result: CommandResult }
  | { status: "queued" }
  | { status: "error"; error: string; details?: unknown };

export type ActionConflict = { clientActionId: string; type: string; error: string };

const NO_PENDING: QueuedCommand[] = [];

/** Commandes organisateur passées par la file : hors connexion, elles partent au retour du réseau. */
export function useOrganizerActions(tournamentId: string, onChange: () => void | Promise<void>) {
  const queue = useMemo(() => {
    const send = async (item: QueuedCommand): Promise<SendOutcome> => {
      try {
        const result = await api(`/api/tournaments/${tournamentId}/actions`, {
          body: { ...item.command, clientActionId: item.clientActionId },
          schema: "commandResultSchema",
        });
        return { kind: "ok", result };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        // Réseau absent, session expirée ou serveur indisponible : on garde l'action pour plus tard.
        if (error.kind === "offline" || error.kind === "session" || error.status >= 500) return { kind: "retry" };
        // Action appliquée mais résultat illisible : pas un refus ; l'état du tournoi est relu ensuite.
        if (error.kind === "invalid") return { kind: "ok", result: { ok: true } satisfies CommandResult };
        return { kind: "rejected", status: error.status, error: error.message || "error", details: error.details };
      }
    };
    return createOfflineQueue(tournamentId, send, typeof window === "undefined" ? null : browserStorage());
  }, [tournamentId]);

  const pending = useSyncExternalStore(queue.subscribe, queue.pending, () => NO_PENDING);
  const [conflicts, setConflicts] = useState<ActionConflict[]>([]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const flush = useCallback(
    async (own?: string) => {
      // Les actions refusées quittent la file : on note leur type avant le passage.
      const types = new Map(queue.pending().map((item) => [item.clientActionId, item.command.type]));
      const report = await queue.flush();
      const rejected: ActionConflict[] = [];
      for (const [clientActionId, outcome] of report.outcomes) {
        if (clientActionId === own || outcome.kind !== "rejected") continue;
        rejected.push({ clientActionId, type: types.get(clientActionId) ?? "", error: outcome.error });
      }
      if (rejected.length) setConflicts((current) => [...current, ...rejected]);
      // On attend le nouvel état : sinon l'écran montre un instant l'ancien résultat après l'action.
      if (report.outcomes.size) await onChangeRef.current();
      return report;
    },
    [queue],
  );

  useEffect(() => {
    const retry = () => {
      if (queue.pending().length) void flush();
    };
    retry();
    const timer = window.setInterval(retry, POLL_INTERVAL_MS);
    window.addEventListener("online", retry);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", retry);
    };
  }, [queue, flush]);

  const act = useCallback(
    async (command: QueuedCommand["command"]): Promise<ActionOutcome> => {
      const item = queue.enqueue(command);
      const report = await flush(item.clientActionId);
      const outcome = report.outcomes.get(item.clientActionId);
      if (!outcome) return { status: "queued" };
      // Résultat vérifié par `send` (commandResultSchema) ; la file le garde sans le typer.
      if (outcome.kind === "ok") return { status: "ok", result: outcome.result as CommandResult };
      if (outcome.kind === "rejected") return { status: "error", error: outcome.error, details: outcome.details };
      return { status: "queued" };
    },
    [queue, flush],
  );

  const dismissConflict = useCallback(
    (clientActionId: string) => setConflicts((current) => current.filter((conflict) => conflict.clientActionId !== clientActionId)),
    [],
  );

  return { act, pending, conflicts, dismissConflict };
}
