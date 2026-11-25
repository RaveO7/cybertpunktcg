"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useCollection } from "@/components/CollectionProvider";
import { usePreferences } from "@/components/PreferencesProvider";
import {
  CollectionCsvError,
  parseCollectionCsv,
  type ImportIssue,
  type ImportPreview,
} from "@/lib/collection-csv";

/** Import CSV de la collection : lecture du fichier, aperçu, puis confirmation. */
export function useCollectionImport() {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const { catalog, importLines } = useCollection();
  const { prefs } = usePreferences();
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<"add" | "set">("add");
  const [importBusy, setImportBusy] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function readImportFile(file: File | undefined) {
    setImportPreview(null);
    setImportNote(null);
    if (!file || !catalog) return;
    setImportBusy(true);
    try {
      const preview = parseCollectionCsv(await file.text(), catalog, {
        defaultCondition: prefs.condition,
        defaultCurrency: prefs.currency,
      });
      if (preview.lines.length === 0) setImportNote(t("settings.importNothing"));
      setImportPreview(preview);
    } catch (caught) {
      const code = caught instanceof CollectionCsvError ? caught.code : null;
      setImportNote(
        code === "empty"
          ? t("settings.importEmpty")
          : code === "no-columns"
            ? t("settings.importNoColumns")
            : code === "too-many"
              ? t("settings.importTooMany")
              : t("settings.importFailed"),
      );
    } finally {
      setImportBusy(false);
    }
  }

  function issueReason(issue: ImportIssue) {
    if (issue.reason === "bad-quantity") return t("settings.importReasonQuantity");
    if (issue.reason === "no-identity") return t("settings.importReasonIdentity");
    return t("settings.importReasonUnknown");
  }

  async function confirmImport() {
    if (!importPreview?.lines.length) return;
    setImportBusy(true);
    setImportNote(null);
    try {
      const summary = await importLines({ mode: importMode, lines: importPreview.lines });
      setImportPreview(null);
      setImportNote(t("settings.importDone", { created: fmt.int(summary.created), updated: fmt.int(summary.updated) }));
    } catch (caught) {
      setImportNote(caught instanceof Error ? caught.message : t("settings.importFailed"));
    } finally {
      setImportBusy(false);
    }
  }

  return {
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
  };
}
