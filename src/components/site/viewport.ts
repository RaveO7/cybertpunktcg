import type { Viewport } from "next";
import { THEME_CHROME_COLORS } from "@/lib/preferences";

export const siteViewport: Viewport = {
  // Couleur des barres du navigateur et du système : celle du thème de l'app, pas celle du téléphone.
  // Sombre par défaut ; themeBootScript puis applyTheme() la corrigent pour le thème clair.
  themeColor: THEME_CHROME_COLORS.dark,
  width: "device-width",
  initialScale: 1,
  // Plein écran sur iPhone (encoche, barre d'accueil) : les marges viennent de env(safe-area-inset-*).
  viewportFit: "cover",
  // Android : le clavier réduit la mise en page au lieu de recouvrir les formulaires.
  interactiveWidget: "resizes-content",
};
