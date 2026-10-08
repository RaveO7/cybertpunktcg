"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { useIsOffline } from "@/components/OfflineSupport";
import {
  clearOfflineImages,
  countCachedImages,
  downloadImages,
  offlineImageUrls,
  offlineSupported,
  type OfflineProgress,
} from "@/lib/offline";
import type { CatalogDTO } from "@/lib/types";

const noopSubscribe = () => () => {};

export function OfflineSection({ catalog }: { catalog: CatalogDTO | null }) {
  const { t } = useI18n();
  const offline = useIsOffline();
  const urls = useMemo(() => (catalog ? offlineImageUrls(catalog) : []), [catalog]);
  const supported = useSyncExternalStore(noopSubscribe, offlineSupported, () => true);
  const [cached, setCached] = useState<number | null>(null);
  const [progress, setProgress] = useState<OfflineProgress | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    countCachedImages(urls)
      .then((count) => {
        if (!cancelled) setCached(count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [urls, supported]);

  // Quitter la page arrête le téléchargement ; il reprendra là où il s'est arrêté.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function download() {
    const controller = new AbortController();
    abortRef.current = controller;
    setNote(null);
    setProgress({ done: 0, total: urls.length, failed: 0 });
    try {
      const result = await downloadImages(urls, setProgress, controller.signal);
      if (result.failed > 0 && !controller.signal.aborted) setNote(t.offline.failed(result.failed));
    } finally {
      abortRef.current = null;
      setProgress(null);
      setCached(await countCachedImages(urls).catch(() => null));
    }
  }

  async function clear() {
    setNote(null);
    await clearOfflineImages();
    setCached(0);
    setNote(t.offline.cleared);
  }

  const busy = progress !== null;
  const missing = cached === null ? urls.length : urls.length - cached;

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t.offline.title}</h2>
      <p className="mt-2 text-sm text-muted">{t.offline.hint}</p>
      {!supported ? (
        <p className="mt-4 text-sm text-muted">{t.offline.unsupported}</p>
      ) : (
        <>
          {cached !== null && urls.length > 0 ? (
            <p className="mt-3 text-sm text-foreground">{t.offline.status(cached, urls.length)}</p>
          ) : null}
          {busy ? (
            <div className="mt-4 space-y-2">
              <div
                className="h-2 w-full overflow-hidden border border-line"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
              >
                <div
                  className="h-full bg-cyan transition-[width]"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted" aria-live="polite">
                  {t.offline.downloading(progress.done, progress.total)}
                </p>
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="h-9 border border-line px-3 text-sm text-muted hover:border-cyan hover:text-cyan"
                >
                  {t.offline.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={offline || urls.length === 0 || missing === 0}
                onClick={() => void download()}
                className="h-12 w-full border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
              >
                {t.offline.download(missing)}
              </button>
              {cached ? (
                <button
                  type="button"
                  onClick={() => void clear()}
                  className="h-10 w-full border border-line text-sm text-muted hover:border-danger hover:text-danger"
                >
                  {t.offline.clear}
                </button>
              ) : null}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">{t.offline.hdNote}</p>
        </>
      )}
      {note ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {note}
        </p>
      ) : null}
    </section>
  );
}
