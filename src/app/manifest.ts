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
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
