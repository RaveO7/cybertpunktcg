"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { collectionToCsv } from "@/lib/collection-csv";
import { ImportPanel } from "./ImportPanel";

function download(content: string, type: string, extension: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cyberpunk-tcg-collection-${new Date().toISOString().slice(0, 10)}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export (CSV, JSON) et import de la collection. */
export function DataSection() {
  const t = useTranslations();
  const { user, items, catalog } = useCollection();
  const [exportNote, setExportNote] = useState<string | null>(null);

  function exportCollection(format: "csv" | "json") {
    setExportNote(null);
    try {
      if (format === "csv") {
        if (!catalog) throw new Error("catalog");
        download(collectionToCsv(items, catalog), "text/csv;charset=utf-8", "csv");
      } else {
        const payload = {
          exportedAt: new Date().toISOString(),
          user: user ? { email: user.email, displayName: user.displayName } : null,
          items,
        };
        download(JSON.stringify(payload, null, 2), "application/json", "json");
      }
      setExportNote(t("settings.exportDone"));
    } catch {
      setExportNote(t("settings.exportFailed"));
    }
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.data")}</h2>
      <p className="mt-2 text-sm text-muted">{t("settings.dataHint")}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!catalog}
          onClick={() => exportCollection("csv")}
          className="h-12 border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
        >
          {t("settings.exportCsv")}
        </button>
        <button
          type="button"
          onClick={() => exportCollection("json")}
          className="h-12 border border-line text-sm text-muted hover:border-cyan hover:text-cyan"
        >
          {t("settings.exportJson")}
        </button>
      </div>
      {exportNote ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {exportNote}
        </p>
      ) : null}

      <ImportPanel />
    </section>
  );
}
