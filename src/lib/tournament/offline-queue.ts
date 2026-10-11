// File d'actions de l'organisateur, conservée sur l'appareil et renvoyée dans l'ordre au retour
// du réseau. Chaque action porte un clientActionId : le serveur ignore un renvoi déjà appliqué.
// Le stockage (localStorage) peut manquer ou lever une exception : la file vit alors en mémoire.

export type QueuedCommand = {
  clientActionId: string;
  command: { type: string } & Record<string, unknown>;
  queuedAt: number;
};

export type SendOutcome =
  | { kind: "ok"; result: unknown }
  /** Refus définitif (4xx) : l'action est retirée et signalée au TO. */
  | { kind: "rejected"; status: number; error: string; details?: unknown }
  /** Réseau absent, serveur indisponible (5xx) ou session expirée : on réessaiera. */
  | { kind: "retry" };

export type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type FlushReport = {
  outcomes: Map<string, SendOutcome>;
  /** Actions encore en attente après ce passage. */
  remaining: number;
};

function newId() {
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createOfflineQueue(
  key: string,
  send: (item: QueuedCommand) => Promise<SendOutcome>,
  storage: QueueStorage | null,
) {
  const storageKey = `cptcg-tournament-queue:${key}`;
  let memory: QueuedCommand[] = read();
  let running: Promise<FlushReport> | null = null;
  const listeners = new Set<() => void>();

  function read(): QueuedCommand[] {
    try {
      const raw = storage?.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as QueuedCommand[]) : [];
    } catch {
      return [];
    }
  }

  function write() {
    try {
      if (memory.length) storage?.setItem(storageKey, JSON.stringify(memory));
      else storage?.removeItem(storageKey);
    } catch {
      // Stockage plein ou interdit : la file reste en mémoire.
    }
    for (const listener of listeners) listener();
  }

  function enqueue(command: QueuedCommand["command"]): QueuedCommand {
    const item = { clientActionId: newId(), command, queuedAt: Date.now() };
    memory = [...memory, item];
    write();
    return item;
  }

  async function drain(): Promise<FlushReport> {
    const outcomes = new Map<string, SendOutcome>();
    while (memory.length > 0) {
      const item = memory[0];
      let outcome: SendOutcome;
      try {
        outcome = await send(item);
      } catch {
        outcome = { kind: "retry" };
      }
      if (outcome.kind === "retry") break;
      outcomes.set(item.clientActionId, outcome);
      memory = memory.filter((candidate) => candidate.clientActionId !== item.clientActionId);
      write();
    }
    return { outcomes, remaining: memory.length };
  }

  /** Renvoie les actions dans l'ordre ; un seul passage à la fois. */
  function flush(): Promise<FlushReport> {
    if (!running) running = drain().finally(() => (running = null));
    return running;
  }

  return {
    enqueue,
    flush,
    pending: () => memory,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>;

/** localStorage s'il est utilisable (navigation privée, données bloquées : null). */
export function browserStorage(): QueueStorage | null {
  try {
    const storage = window.localStorage;
    const probe = "cptcg-probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
