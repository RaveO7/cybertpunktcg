"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useCollection } from "@/components/CollectionProvider";
import { IssueList } from "./IssueList";
import { useCollectionImport } from "./use-collection-import";

export function ImportPanel() {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const { catalog } = useCollection();
  const {
    importPreview,
    setImportPreview,
    importMode,
    setImportMode,
    importBusy,
    importNote,
    fileInput,
    readImportFile,
    issueReason,
    confirmImport,
  } = useCollectionImport();

  return (
    <>
      <h3 className="mt-6 text-xs uppercase tracking-[0.14em] text-muted">{t("settings.importTitle")}</h3>
      <p className="mt-2 text-sm text-muted">{t("settings.importHint")}</p>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.txt,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void readImportFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {importPreview && importPreview.lines.length > 0 ? (
        <div className="mt-4 space-y-3 border border-line p-4 text-sm">
          <p className="text-muted">
            {importPreview.format === "app"
              ? t("settings.importFormatApp")
              : importPreview.format === "cardmarket"
                ? t("settings.importFormatCardmarket")
                : t("settings.importFormatGeneric")}
          </p>
          <p className="text-foreground">
            {t("settings.importSummary", { lines: fmt.int(importPreview.lines.length), copies: fmt.int(importPreview.copies) })}
          </p>
          {importPreview.format === "cardmarket" ? (
            <p className="text-xs text-muted">{t("settings.importCardmarketPrice")}</p>
          ) : null}
          <IssueList
            title={t("settings.importGuessed", { n: fmt.int(importPreview.guessed.length) })}
            issues={importPreview.guessed}
            more={(n) => t("settings.importMore", { n })}
            tone="text-yellow"
          />
          <IssueList
            title={t("settings.importRejected", { n: fmt.int(importPreview.rejected.length) })}
            issues={importPreview.rejected}
            more={(n) => t("settings.importMore", { n })}
            reason={issueReason}
            tone="text-danger"
          />
          <fieldset className="space-y-2">
            {(
              [
                { value: "add", label: t("settings.importModeAdd") },
                { value: "set", label: t("settings.importModeSet") },
              ] as const
            ).map((option) => (
              <label key={option.value} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="import-mode"
                  className="mt-1 accent-cyan"
                  checked={importMode === option.value}
                  onChange={() => setImportMode(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={importBusy}
              onClick={() => void confirmImport()}
              className="h-11 border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
            >
              {importBusy ? t("settings.importing") : t("settings.importConfirm")}
            </button>
            <button
              type="button"
              disabled={importBusy}
              onClick={() => setImportPreview(null)}
              className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
            >
              {t("settings.importCancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={importBusy || !catalog}
            onClick={() => fileInput.current?.click()}
            className="mt-4 h-12 w-full border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
          >
            {importBusy ? t("settings.importReading") : t("settings.importChoose")}
          </button>
          {importPreview && importPreview.rejected.length > 0 ? (
            <div className="mt-3 text-sm">
              <IssueList
                title={t("settings.importRejected", { n: fmt.int(importPreview.rejected.length) })}
                issues={importPreview.rejected}
                more={(n) => t("settings.importMore", { n })}
                reason={issueReason}
                tone="text-danger"
              />
            </div>
          ) : null}
        </>
      )}
      {importNote ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {importNote}
        </p>
      ) : null}
    </>
  );
}
