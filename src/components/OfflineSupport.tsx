"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** false côté serveur et à l'hydratation, puis l'état réel du navigateur. */
export function useIsOffline() {
  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
}

/** Écrans gardés hors ligne dès l'installation, dans la langue de la page. */
const SHELL_ROUTES = ["/", "/cards", "/investissement", "/decks", "/souhaits", "/comment-jouer", "/parametres"] as const;

/**
 * Enregistre public/sw.js (production uniquement : en dev, le cache gênerait le rechargement à chaud).
 * Les adresses des écrans et le texte de la page « hors ligne » lui sont passés dans l'URL du script,
 * dans la langue de la page : changer de langue installe une nouvelle version du service worker.
 */
export function ServiceWorkerRegister() {
  const locale = useLocale();
  const t = useTranslations("offline.page");
  const params = new URLSearchParams({
    lang: locale,
    pages: SHELL_ROUTES.map((href) => getPathname({ href, locale })).join(","),
    title: t("title"),
    body: t("body"),
    home: t("home"),
  }).toString();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?${params}`, { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, [params]);
  return null;
}

export function OfflineBanner() {
  const offline = useIsOffline();
  const t = useTranslations();
  if (!offline) return null;
  return (
    <p role="status" className="shrink-0 border-b border-yellow/40 bg-yellow/10 px-4 py-1.5 text-center text-xs text-yellow">
      {t("offline.banner")}
    </p>
  );
}
