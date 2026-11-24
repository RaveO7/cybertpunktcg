import type { Viewport } from "next";

export const siteViewport: Viewport = {
  // Pas de themeColor ici : la <meta name="theme-color"> est posée par themeBootScript (SiteShell) puis
  // applyTheme(). Depuis Next 16.4, celle du viewport est réécrite en sombre à l'hydratation et écrasait
  // le thème clair.
  width: "device-width",
  initialScale: 1,
  // Plein écran sur iPhone (encoche, barre d'accueil) : les marges viennent de env(safe-area-inset-*).
  viewportFit: "cover",
  // Android : le clavier réduit la mise en page au lieu de recouvrir les formulaires.
  interactiveWidget: "resizes-content",
};
