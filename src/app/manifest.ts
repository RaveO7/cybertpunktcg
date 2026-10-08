import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Collection Cyberpunk TCG",
    short_name: "CPTCG",
    description: "Gestion de collection Cyberpunk TCG",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    lang: "fr",
    // Appui long sur l'icône (Android) : accès direct aux écrans principaux.
    shortcuts: [
      { name: "Cartes", url: "/cards", icons: [{ src: "/icons/icon-192.png?v=2", sizes: "192x192" }] },
      { name: "Investissement", url: "/investissement", icons: [{ src: "/icons/icon-192.png?v=2", sizes: "192x192" }] },
    ],
    // `?v=` force Android (serveur WebAPK de Google) à recharger les icônes : à incrémenter quand elles changent.
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
