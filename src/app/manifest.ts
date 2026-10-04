import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collection Cyberpunk TCG",
    short_name: "CPTCG",
    description: "Gestion de collection Cyberpunk TCG",
    start_url: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    lang: "fr",
  };
}
