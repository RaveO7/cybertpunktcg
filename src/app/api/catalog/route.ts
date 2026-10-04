import { NextResponse } from "next/server";
import { loadCatalogCached } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadCatalogCached();
  return NextResponse.json(catalog, {
    // Données publiques : le CDN (Vercel) peut les servir sans appeler la fonction.
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
