/**
 * IndexNow : prévient Bing (qui alimente Copilot) et les autres moteurs du protocole qu'une page a changé.
 * La clé n'est pas un secret : elle est publiée dans public/<clé>.txt pour prouver que le site est à nous.
 */
import type { MetadataRoute } from "next";

export const INDEXNOW_KEY = "50a2a4bf3353a9405cbcbec04eba440c";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Maximum du protocole par requête. */
export const INDEXNOW_MAX_URLS = 10_000;

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

/**
 * URL à signaler : pages modifiées après `since` (celles sans date ne changent pas d'elles-mêmes),
 * ou toutes si `since` est absent (premier envoi).
 */
export function indexNowUrls(entries: MetadataRoute.Sitemap, since: Date | null): string[] {
  if (!since) return entries.map((entry) => entry.url);
  return entries.filter((entry) => entry.lastModified && new Date(entry.lastModified) > since).map((entry) => entry.url);
}

/** Corps des requêtes POST, par lots de 10 000 URL au plus. */
export function indexNowPayloads(siteUrl: string, urls: string[]): IndexNowPayload[] {
  const host = new URL(siteUrl).host;
  const payloads: IndexNowPayload[] = [];
  for (let start = 0; start < urls.length; start += INDEXNOW_MAX_URLS) {
    payloads.push({ host, key: INDEXNOW_KEY, keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(start, start + INDEXNOW_MAX_URLS) });
  }
  return payloads;
}
