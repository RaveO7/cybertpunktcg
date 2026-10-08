"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/components/LocaleProvider";

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

/** Enregistre public/sw.js (production uniquement : en dev, le cache gênerait le rechargement à chaud). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}

export function OfflineBanner() {
  const offline = useIsOffline();
  const { t } = useI18n();
  if (!offline) return null;
  return (
    <p role="status" className="shrink-0 border-b border-yellow/40 bg-yellow/10 px-4 py-1.5 text-center text-xs text-yellow">
      {t.offline.banner}
    </p>
  );
}
