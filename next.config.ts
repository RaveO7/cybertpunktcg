import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Tests e2e : un dossier de build à part (NEXT_DIST_DIR=.next-e2e) permet de lancer leur serveur
  // pendant que le `next dev` habituel tourne (le verrou de next dev est rangé dans ce dossier).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Mise en page racine sous [locale] : la 404 des URL sans route est rendue à part.
    globalNotFound: true,
    // Navigation instantanée : une page dynamique déjà vue est réaffichée depuis le cache du routeur
    // pendant 30 s (les pages statiques et les liens préchargés en entier : 5 min). Ce cache est vidé à
    // chaque connexion/déconnexion (router.refresh dans CollectionProvider).
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
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
