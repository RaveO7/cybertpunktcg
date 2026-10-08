// Mode hors-ligne : téléchargement des images de cartes dans le cache du service worker (public/sw.js).

import { CARD_IMAGES_PREFIX, thumbnailPath } from "@/lib/card-image";
import type { CatalogDTO } from "@/lib/types";

/** Doit rester identique à IMAGES_CACHE dans public/sw.js. */
export const OFFLINE_IMAGES_CACHE = "cptcg-images-v1";

const DOWNLOAD_CONCURRENCY = 6;

export type OfflineProgress = { done: number; total: number; failed: number };

/** Miniatures de toutes les impressions du catalogue (dédoublonnées), ou l'image d'origine si elle n'en a pas. */
export function offlineImageUrls(catalog: Pick<CatalogDTO, "printings">): string[] {
  const urls = new Set<string>();
  for (const printing of catalog.printings) {
    const src = printing.imagePath;
    if (!src || !src.startsWith(CARD_IMAGES_PREFIX)) continue;
    urls.add(thumbnailPath(src) ?? src);
  }
  return [...urls].sort();
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;
}

/** Nombre d'URL déjà présentes dans le cache des images. */
export async function countCachedImages(urls: string[]): Promise<number> {
  const cache = await caches.open(OFFLINE_IMAGES_CACHE);
  const keys = await cache.keys();
  const cached = new Set(keys.map((request) => new URL(request.url).pathname));
  return urls.filter((url) => cached.has(url)).length;
}

/** Télécharge les images manquantes ; reprend là où un téléchargement précédent s'était arrêté. */
export async function downloadImages(
  urls: string[],
  onProgress: (progress: OfflineProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineProgress> {
  const cache = await caches.open(OFFLINE_IMAGES_CACHE);
  const progress: OfflineProgress = { done: 0, total: urls.length, failed: 0 };
  let next = 0;

  async function worker() {
    while (next < urls.length && !signal?.aborted) {
      const url = urls[next++];
      try {
        if (!(await cache.match(url))) {
          const response = await fetch(url, { signal });
          if (!response.ok) throw new Error(String(response.status));
          await cache.put(url, response);
        }
      } catch {
        if (signal?.aborted) return;
        progress.failed++;
      }
      progress.done++;
      onProgress({ ...progress });
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
  return progress;
}

export async function clearOfflineImages(): Promise<void> {
  await caches.delete(OFFLINE_IMAGES_CACHE);
}
