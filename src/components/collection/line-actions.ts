import { api } from "@/lib/client/api";
import { matchLine, sameLine } from "@/lib/collection-line";
import { type NewOp, newTempId } from "@/lib/offline-queue";
import type { AuthUser, CollectionItemDTO } from "@/lib/types";
import type { LatestCollection } from "@/components/collection/use-offline-queue";
import type { CollectionContextValue } from "@/components/collection/types";

type LineActionsDeps = {
  user: AuthUser | null;
  /** Valeurs affichées au moment de l'appel (pas du rendu). */
  readLatest: () => LatestCollection;
  errors: (key: "sessionExpired" | "addFailed" | "importFailed") => string;
  /** Envoie la modification, ou la met en file hors ligne (« queued » : rien n'a été envoyé). */
  request: (op: NewOp) => Promise<"sent" | "queued">;
  editItems: (update: (current: CollectionItemDTO[]) => CollectionItemDTO[]) => void;
  /** Échec d'une action du compte : message traduit, et session close si le serveur l'a refusée. */
  actionError: (error: unknown, fallback: string) => Error;
};

type LineActions = Pick<
  CollectionContextValue,
  "saveLine" | "saveBatch" | "importLines" | "patchLine" | "deleteLine"
>;

/** Écritures sur les lignes de la collection (ajout, lot, import, modification, suppression). */
export function createLineActions({ user, readLatest, errors, request, editItems, actionError }: LineActionsDeps): LineActions {
  return {
    saveLine: async (input) => {
      // Ligne identique déjà affichée (carte × état × prix × date × notes, comme la fusion faite par le serveur),
      // sinon id temporaire.
      const existing = matchLine(
        readLatest().items.filter((item) => item.printingId === input.printingId),
        input,
      );
      await request({ kind: "save", lineId: existing?.id ?? newTempId(), payload: input });
    },
    saveBatch: async (input) => {
      if (!user) throw new Error(errors("sessionExpired"));
      const result = await api("/api/collection/bulk", { body: input, schema: "collectionItemsSchema" }).catch((error: unknown) => {
        throw actionError(error, errors("addFailed"));
      });
      editItems((current) => {
        const incoming = new Map(result.items.map((item) => [item.id, item]));
        return [...current.filter((item) => !incoming.has(item.id)), ...incoming.values()];
      });
    },
    importLines: async (input) => {
      if (!user) throw new Error(errors("sessionExpired"));
      const result = await api("/api/collection/import", { body: input, schema: "collectionImportSchema" }).catch((error: unknown) => {
        throw actionError(error, errors("importFailed"));
      });
      editItems(() => result.items);
      return { created: result.created, updated: result.updated, skipped: result.skipped };
    },
    patchLine: async (id, input) => {
      // Mise à jour optimiste : l'interface reflète la modification sans attendre le serveur.
      // Une ligne devenue identique à une autre (état, prix, date, notes) fusionne : on laisse alors le serveur trancher.
      // Copie du serveur seulement : une ligne créée hors ligne n'existe que dans la file.
      const { serverItems } = readLatest();
      const previous = serverItems.find((item) => item.id === id);
      const merges =
        previous != null &&
        serverItems.some(
          (item) => item.id !== id && item.printingId === previous.printingId && sameLine(item, { ...previous, ...input }),
        );
      const optimistic = previous && input.conditionCode === undefined && !merges;
      if (optimistic) {
        editItems((current) =>
          input.quantity != null && input.quantity <= 0
            ? current.filter((item) => item.id !== id)
            : current.map((item) => (item.id === id ? { ...item, ...input } : item)),
        );
      }
      const restore = () => {
        if (optimistic) editItems((current) => [...current.filter((item) => item.id !== id), previous]);
      };
      try {
        const sent = await request({ kind: "patch", lineId: id, payload: input });
        // En file : la modification s'affiche par la file, la copie du serveur reste celle du serveur.
        if (sent === "queued") restore();
      } catch (error) {
        restore();
        throw error;
      }
    },
    deleteLine: async (id) => {
      await request({ kind: "delete", lineId: id, payload: null });
    },
  };
}
