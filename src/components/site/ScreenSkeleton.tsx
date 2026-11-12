"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/** Bloc gris à la place d'un contenu pas encore chargé ; immobile quand l'utilisateur demande moins d'animations. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-panel-2 motion-reduce:animate-none ${className}`} />;
}

/** Lignes d'une liste ou d'un tableau en cours de chargement. */
export function SkeletonRows({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col divide-y divide-line border border-line bg-panel ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <SkeletonBlock className="h-4 flex-1" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Écran en cours de chargement : zone marquée occupée, annoncée « Chargement » aux lecteurs d'écran.
 * Les enfants reprennent la disposition de l'écran avec des `SkeletonBlock` / `SkeletonRows`.
 */
export function ScreenSkeleton({
  label,
  className = "",
  children,
}: {
  /** Libellé lu par les lecteurs d'écran (par défaut « Chargement… »). */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {label ?? t("common.loading")}
      </p>
      {children}
    </div>
  );
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/**
 * Chargement échoué : message et bouton « Réessayer » à la place du squelette. Hors ligne (et sans copie
 * gardée sur l'appareil, sinon l'écran l'affiche), le message dit qu'il faut une connexion.
 */
export function ScreenError({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  const t = useTranslations();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  return (
    <div role="alert" className={`flex flex-col items-start gap-3 border border-line bg-panel p-5 ${className}`}>
      <p className="text-sm text-danger">{online ? message : t("errors.offlineLoad")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-11 items-center border border-cyan px-4 text-sm font-semibold text-cyan hover:bg-cyan/10"
      >
        {t("errors.retry")}
      </button>
    </div>
  );
}
