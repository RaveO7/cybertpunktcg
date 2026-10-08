// Suivi des erreurs serveur. Toujours journalisé (logs Vercel) ; si ALERT_WEBHOOK_URL est défini
// (webhook Discord ou Slack), une alerte y est aussi envoyée. Ne lève jamais d'exception.

const DEDUPE_MS = 10 * 60_000;
const recentAlerts = new Map<string, number>();

function describe(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    // Objet circulaire, BigInt… : jamais d'exception.
    try {
      return String(error);
    } catch {
      return "[erreur non sérialisable]";
    }
  }
}

function logLine(entry: Record<string, unknown>) {
  try {
    return JSON.stringify(entry);
  } catch {
    // Contexte non sérialisable : on garde au moins la source et le message.
    return JSON.stringify({ level: entry.level, source: entry.source, message: entry.message, context: "[non sérialisable]" });
  }
}

/** Envoie un message au webhook d'alerte (Discord : `content`, Slack : `text`). */
export async function sendAlert(message: string) {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return false;
  const now = Date.now();
  // Évite d'inonder le canal avec la même erreur répétée sur une instance.
  const last = recentAlerts.get(message);
  if (last && now - last < DEDUPE_MS) return false;
  recentAlerts.set(message, now);
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local";
  const text = `[cybertpunktcg · ${env}] ${message}`.slice(0, 1900);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: text, text }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.error(`Envoi de l'alerte impossible : ${describe(error)}`);
    return false;
  }
}

export async function reportError(source: string, error: unknown, context?: Record<string, unknown>) {
  try {
    const message = describe(error);
    console.error(logLine({ level: "error", source, message, ...context }));
    await sendAlert(`Erreur ${source} : ${message}`);
  } catch {
    // Promesse du module : ne jamais lever (même si console.error elle-même échoue).
  }
}
