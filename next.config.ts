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
    // Pas d'inlineCss : Next recopie alors le CSS deux fois dans le HTML (<style> + flux RSC), 144 → 378 Ko
    // sur l'accueil. Ce HTML plus lourd finit d'arriver après le premier affichage, et son analyse
    // (styles, mise en page) devient du temps de blocage : Lighthouse mobile local, feuilles liées contre CSS
    // en ligne, note 78 → 83, TBT 255 → 131 ms, LCP −390 ms, FCP +110 ms.
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
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            // Volontairement sans script-src/style-src/img-src : ils casseraient les scripts en ligne de Next,
            // Vercel Analytics/Speed Insights et les tuiles Leaflet. Seules les protections sans effet de bord
            // (clickjacking, <base>, plugins, cibles de formulaire ; OAuth Google/Apple par précaution).
            value:
              "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com https://appleid.apple.com",
          },
          {
            key: "Permissions-Policy",
            // Géolocalisation pour soi seulement : recherche « autour de moi » de l'annuaire des tournois.
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        // Images de cartes et icônes (fichiers de public/, servis sinon en max-age=0) : gardées 1 jour
        // puis reprises en arrière-plan pendant 7 jours. Pas d'« immutable » : leurs noms n'ont pas
        // de hash de contenu, une image remplacée doit finir par arriver.
        source: "/:dir(card-images|icons)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
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
