"use client";

import { useTranslations } from "next-intl";

/**
 * Écran de démarrage plein écran : prolonge le splash Android de l'application installée (même fond que
 * `background_color` du manifeste, même icône, centrée) jusqu'à ce que l'écran demandé soit prêt.
 * Recouvre l'en-tête et la barre d'onglets, qui ne connaissent pas encore la session.
 */
export function AppSplash() {
  const t = useTranslations();
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07080d]" role="status" aria-live="polite">
      <img src="/icons/icon-512.png?v=2" alt="" className="w-[min(70vw,18rem)]" fetchPriority="high" draggable={false} />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
