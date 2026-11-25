import type { ImportLine } from "@/lib/collection-csv";
import type { AuthUser, CatalogDTO, CollectionItemDTO } from "@/lib/types";

export type ImportSummary = { created: number; updated: number; skipped: number };

/**
 * Statut de la session, indépendant du chargement des données (`ready`) : « unknown » avant la lecture
 * de l'appareil, « guest » sans session mémorisée tant que le serveur n'a pas été interrogé (pages
 * publiques), « signed-out » seulement après un refus du serveur (401) ou la déconnexion.
 */
export type SessionStatus = "unknown" | "guest" | "signed-in" | "signed-out";

/** Modification refusée par le serveur pendant la synchronisation. */
export type SyncError = { id: string; userId: string; kind: "rejected" | "corrupted"; card: string | null; message: string };

export type SaveInput = {
  printingId: string;
  conditionCode: string;
  quantity: number;
  mode: "add" | "set";
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
  purchasedAt?: string | null;
};

export type PatchInput = {
  conditionCode?: string;
  quantity?: number;
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
  purchasedAt?: string | null;
};

export type CollectionContextValue = {
  session: SessionStatus;
  ready: boolean;
  error: string | null;
  /** Relance le chargement du catalogue et de la collection après une erreur. */
  retry: () => void;
  user: AuthUser | null;
  catalog: CatalogDTO | null;
  items: CollectionItemDTO[];
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  saveLine: (input: SaveInput) => Promise<void>;
  saveBatch: (input: {
    conditionCode: string;
    lines: { printingId: string; quantity: number }[];
  }) => Promise<void>;
  importLines: (input: { mode: "add" | "set"; lines: ImportLine[] }) => Promise<ImportSummary>;
  patchLine: (id: string, input: PatchInput) => Promise<void>;
  deleteLine: (id: string) => Promise<void>;
  /** Page réservée aux comptes : vérifie la session auprès du serveur même sans session mémorisée. */
  requireSession: () => void;
  /** Écran qui affiche le catalogue sur la liste des decks, où il n'est pas chargé d'office (useCatalogGate). */
  requireCatalog: () => void;
  /** Modifications faites hors ligne, pas encore envoyées au serveur. */
  pendingCount: number;
  /** Lignes visées par une modification en attente. */
  pendingIds: ReadonlySet<string>;
  syncing: boolean;
  syncErrors: SyncError[];
  dismissSyncError: (id: string) => void;
};
