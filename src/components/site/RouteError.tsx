"use client";

import { useI18n } from "@/components/LocaleProvider";
import { StatusScreen } from "@/components/StatusScreen";

// L'erreur est déjà journalisée et signalée côté serveur (instrumentation.ts) ;
// le digest permet de la retrouver dans les logs.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();
  return (
    <StatusScreen eyebrow={t.errors.eyebrow} title={t.errors.title} body={t.errors.body}>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-12 items-center border border-cyan px-4 text-sm text-cyan hover:bg-cyan/10"
      >
        {t.errors.retry}
      </button>
      {error.digest ? (
        <p className="w-full font-mono text-xs text-muted">
          {t.errors.reference} : {error.digest}
        </p>
      ) : null}
    </StatusScreen>
  );
}
