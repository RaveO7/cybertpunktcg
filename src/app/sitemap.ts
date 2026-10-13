import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/seo/sitemap";

// Régénéré au plus toutes les heures : nouvelles boutiques, tournois et cartes y entrent sans déploiement.
export const revalidate = 3600;

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap();
}
