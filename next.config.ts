import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Plusieurs mises en page racines ((fr) et (en)) : la 404 des URL sans route est rendue à part.
    globalNotFound: true,
  },
  async redirects() {
    // Anciennes pages publiques de liste : tout est désormais sur l'accueil (les fiches détail restent),
    // sauf la liste des cartes (/cartes, /en/cards), qui relie toutes les fiches.
    // /tournois/publics, /boutiques et /comment-jouer existent encore pour les comptes connectés et
    // renvoient eux-mêmes les visiteurs vers l'accueil.
    return [
      { source: "/en/tournaments", destination: "/en#tournaments", permanent: true },
      { source: "/en/shops", destination: "/en#shops", permanent: true },
      { source: "/en/how-to-play", destination: "/en", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Géolocalisation pour soi seulement : recherche « autour de moi » de l'annuaire des tournois.
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        // Service worker (mode hors-ligne) : jamais mis en cache HTTP, pour que les mises à jour arrivent.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
