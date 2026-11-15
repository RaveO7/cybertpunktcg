import type { z } from "zod";
import type { clientErrorSchema } from "@/lib/api-schemas";
import { api } from "@/lib/client/api";

// Au plus quelques envois par chargement de page : une erreur répétée en boucle ne doit pas inonder les logs.
const MAX_REPORTS = 5;

type ClientErrorReport = z.infer<typeof clientErrorSchema>;

/**
 * Erreur à remonter, ou null : erreurs venues d'un autre site (extension du navigateur, script tiers ;
 * le navigateur n'en donne que « Script error. ») et requêtes annulées sont ignorées.
 */
export function toReport(error: unknown, origin: string, location: { pathname: string; serviceWorker: boolean }): ClientErrorReport | null {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (!message || message === "Script error." || (error instanceof DOMException && error.name === "AbortError")) return null;
  const stack = error instanceof Error ? error.stack : undefined;
  if (stack && /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack)) return null;
  if (stack && !stack.includes(origin) && /https?:\/\//.test(stack)) return null;
  return { message: message.slice(0, 1000), stack: stack?.slice(0, 4000), path: location.pathname.slice(0, 500), serviceWorker: location.serviceWorker };
}

/** Écoute les erreurs non rattrapées de la page (dont celles que React signale avec `reportError`). */
export function installErrorReporting() {
  const sent = new Set<string>();
  const send = (error: unknown) => {
    const report = toReport(error, window.location.origin, {
      pathname: window.location.pathname,
      serviceWorker: Boolean(navigator.serviceWorker?.controller),
    });
    if (!report || sent.has(report.message) || sent.size >= MAX_REPORTS) return;
    sent.add(report.message);
    // Échec de l'envoi (hors ligne, limite atteinte) : rien à faire de plus, et le signaler à son tour
    // relancerait ce même gestionnaire.
    api("/api/client-errors", { body: report, keepalive: true }).catch(() => undefined);
  };
  window.addEventListener("error", (event) => send(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => send(event.reason));
}
