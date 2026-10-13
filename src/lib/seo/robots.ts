import type { MetadataRoute } from "next";
import { absoluteUrl, isProductionDeployment } from "@/lib/seo/site";

/** robots.txt : production explorable (hors API et administration), tout autre déploiement fermé. */
export function buildRobots(env: Record<string, string | undefined> = process.env): MetadataRoute.Robots {
  if (!isProductionDeployment(env)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Les logos de boutique (servis par l'API) restent lisibles : ils illustrent les fiches et leurs données structurées.
    rules: { userAgent: "*", allow: ["/", "/api/shops/*/logo"], disallow: ["/api/", "/admin"] },
    sitemap: absoluteUrl("/sitemap.xml", env),
  };
}
