"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StatusScreen } from "@/components/StatusScreen";

const CHUNK_RELOAD_KEY = "cptcg-chunk-reload";

/**
 * Code d'une ancienne version introuvable : l'app installée affiche son écran enregistré sans attendre le
 * serveur (public/sw.js), et un module chargé à la demande peut avoir disparu avec un nouveau
 * déploiement. Un rechargement (une seule fois par minute) récupère la nouvelle version.
 */
function useReloadOnMissingChunk(error: Error) {
  useEffect(() => {
    if (!/Failed to load chunk|ChunkLoadError|Loading chunk/i.test(error.message)) return;
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);
}

// L'erreur est déjà journalisée et signalée côté serveur (instrumentation.ts) ;
// le digest permet de la retrouver dans les logs.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations();
  useReloadOnMissingChunk(error);
  return (
    <StatusScreen eyebrow={t("errors.eyebrow")} title={t("errors.title")} body={t("errors.body")}>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-12 items-center border border-cyan px-4 text-sm text-cyan hover:bg-cyan/10"
      >
        {t("errors.retry")}
      </button>
      {error.digest ? (
        <p className="w-full font-mono text-xs text-muted">
          {t("errors.reference")} : {error.digest}
        </p>
      ) : null}
    </StatusScreen>
  );
}
