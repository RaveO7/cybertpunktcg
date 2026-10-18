import { createHash } from "node:crypto";
import { loadCatalogCached } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// Données publiques : le CDN (Vercel) peut les servir sans appeler la fonction.
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

/**
 * Catalogue public (environ 500 Ko). Avec son empreinte (ETag), l'app qui a déjà la même version
 * reçoit un 304 vide au lieu de tout retélécharger.
 */
export async function GET(request: Request) {
  const body = JSON.stringify(await loadCatalogCached());
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { "Cache-Control": CACHE_CONTROL, ETag: etag };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
}
