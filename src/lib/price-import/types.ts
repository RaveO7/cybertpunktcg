import type { PrismaClient } from "@prisma/client";

export type PriceFiles = { products: string; prices: string; nonsingles: string | null };

export type ImportPricesOptions = {
  /** Dossier où les fichiers Cardmarket sont téléchargés / lus. */
  cacheDir: string;
  /** N'utilise que les fichiers déjà présents dans cacheDir. */
  offline?: boolean;
  /** Importe même si ce guide de prix a déjà été importé. */
  force?: boolean;
  /** Fichiers précis à importer (ignore le téléchargement). */
  files?: PriceFiles;
  log?: (message: string) => void;
};

export type ImportPricesResult =
  | { status: "skipped"; message: string }
  | { status: "imported"; report: Record<string, unknown> };

export type Ctx = { prisma: PrismaClient; cacheDir: string; log: (message: string) => void };
