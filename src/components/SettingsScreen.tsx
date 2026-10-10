"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import { OfflineSection } from "@/components/OfflineSection";
import { usePreferences } from "@/components/PreferencesProvider";
import {
  CollectionCsvError,
  collectionToCsv,
  parseCollectionCsv,
  type ImportIssue,
  type ImportPreview,
} from "@/lib/collection-csv";
import { LOCALES, type Locale } from "@/lib/i18n/messages";
import { formatInt } from "@/lib/logic";
import { CURRENCIES } from "@/lib/parse";
import { CONDITIONS } from "@/lib/reference-data";
import type { FiltersPanelMode, UserPreferences } from "@/lib/preferences";
import type { CollectionFilter, SortKey } from "@/lib/types";

type ShareState = {
  active: boolean;
  url?: string;
  createdAt?: string;
};

function sortOptions(t: ReturnType<typeof useI18n>["t"]): { value: SortKey; label: string }[] {
  return [
    { value: "default", label: t.cards.sortDefault },
    { value: "number-asc", label: t.cards.sortNumberAsc },
    { value: "number-desc", label: t.cards.sortNumberDesc },
    { value: "cost-asc", label: t.cards.sortCostAsc },
    { value: "cost-desc", label: t.cards.sortCostDesc },
    { value: "name-asc", label: t.cards.sortNameAsc },
    { value: "name-desc", label: t.cards.sortNameDesc },
    { value: "rarity", label: t.cards.sortRarity },
    { value: "set", label: t.cards.groupSet },
    { value: "owned-first", label: t.cards.groupOwnedFirst },
    { value: "missing-first", label: t.cards.groupMissingFirst },
  ];
}

export function SettingsScreen() {
  const { user, ready, logout, items, catalog, importLines } = useCollection();
  const { locale, setLocale, t } = useI18n();
  const { prefs, setPrefs, resetPrefs } = usePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [share, setShare] = useState<ShareState | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<"add" | "set">("add");
  const [importBusy, setImportBusy] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sorts = useMemo(() => sortOptions(t), [t]);

  const collectionOptions: { value: CollectionFilter; label: string }[] = [
    { value: "all", label: t.filters.allCards },
    { value: "owned", label: t.filters.owned },
    { value: "missing", label: t.filters.missing },
    { value: "duplicates", label: t.filters.duplicates },
  ];

  const panelOptions: { value: FiltersPanelMode; label: string }[] = [
    { value: "auto", label: t.settings.filtersPanelAuto },
    { value: "open", label: t.settings.filtersPanelOpen },
    { value: "closed", label: t.settings.filtersPanelClosed },
  ];

  useEffect(() => {
    let cancelled = false;
    async function loadShare() {
      try {
        const response = await fetch("/api/share", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as ShareState;
        if (!cancelled) setShare(body);
      } catch {
        if (!cancelled) setShare({ active: false });
      }
    }
    if (user) void loadShare();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onLogout() {
    setPending(true);
    setError(null);
    try {
      await logout();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.settings.logoutFailed);
    } finally {
      setPending(false);
    }
  }

  function download(content: string, type: string, extension: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cyberpunk-tcg-collection-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
      setExportNote(t.settings.exportDone);
    } catch {
      setExportNote(t.settings.exportFailed);
    }
  }

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
      if (preview.lines.length === 0) setImportNote(t.settings.importNothing);
      setImportPreview(preview);
    } catch (caught) {
      const code = caught instanceof CollectionCsvError ? caught.code : null;
      setImportNote(
        code === "empty"
          ? t.settings.importEmpty
          : code === "no-columns"
            ? t.settings.importNoColumns
            : code === "too-many"
              ? t.settings.importTooMany
              : t.settings.importFailed,
      );
    } finally {
      setImportBusy(false);
    }
  }

  function issueReason(issue: ImportIssue) {
    if (issue.reason === "bad-quantity") return t.settings.importReasonQuantity;
    if (issue.reason === "no-identity") return t.settings.importReasonIdentity;
    return t.settings.importReasonUnknown;
  }

  async function confirmImport() {
    if (!importPreview?.lines.length) return;
    setImportBusy(true);
    setImportNote(null);
    try {
      const summary = await importLines({ mode: importMode, lines: importPreview.lines });
      setImportPreview(null);
      setImportNote(t.settings.importDone(formatInt(summary.created), formatInt(summary.updated)));
    } catch (caught) {
      setImportNote(caught instanceof Error ? caught.message : t.settings.importFailed);
    } finally {
      setImportBusy(false);
    }
  }

  async function createShare(rotate = false) {
    setShareBusy(true);
    setShareNote(null);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const body = (await response.json()) as ShareState & { error?: string };
      if (!response.ok) throw new Error(body.error || t.settings.shareFailed);
      setShare(body);
      setShareNote(rotate ? t.settings.shareRotated : t.settings.shareCreated);
    } catch (caught) {
      setShareNote(caught instanceof Error ? caught.message : t.settings.shareFailed);
    } finally {
      setShareBusy(false);
    }
  }

  async function revokeShareLink() {
    setShareBusy(true);
    setShareNote(null);
    try {
      const response = await fetch("/api/share", { method: "DELETE" });
      if (!response.ok) throw new Error(t.settings.shareFailed);
      setShare({ active: false });
      setShareNote(t.settings.shareRevoked);
    } catch (caught) {
      setShareNote(caught instanceof Error ? caught.message : t.settings.shareFailed);
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!share?.url) return;
    setShareNote(null);
    try {
      await navigator.clipboard.writeText(share.url);
      setShareNote(t.settings.shareCopied);
    } catch {
      setShareNote(t.settings.shareCopyFailed);
    }
  }

  function patchPref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs({ [key]: value } as Partial<UserPreferences>);
  }

  if (!ready) {
    return <p className="p-6 text-muted">{t.settings.loading}</p>;
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t.settings.eyebrow}</p>
      <h1 className="mt-1 text-3xl text-yellow">{t.settings.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.settings.subtitle}</p>

      <dl className="mt-8 space-y-4 border-t border-line pt-6">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.displayName}</dt>
          <dd className="mt-1 text-base text-foreground">{user.displayName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.email}</dt>
          <dd className="mt-1 break-all text-base text-foreground">{user.email}</dd>
        </div>
      </dl>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.language}</h2>
        <p className="mt-2 text-sm text-muted">{t.settings.languageHint}</p>
        <label className="mt-4 block text-sm">
          <span className="sr-only">{t.settings.language}</span>
          <select
            className="h-12 w-full border border-line bg-background px-3 text-base outline-none focus:border-cyan"
            value={locale}
            aria-label={t.settings.language}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {LOCALES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.theme}</h2>
        <p className="mt-2 text-sm text-muted">{t.settings.themeHint}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              { value: "dark", label: t.settings.themeDark },
              { value: "light", label: t.settings.themeLight },
            ] as const
          ).map((option) => {
            const active = prefs.theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => patchPref("theme", option.value)}
                aria-pressed={active}
                className={`h-12 border text-sm ${
                  active
                    ? "border-cyan bg-cyan/10 text-cyan"
                    : "border-line text-muted hover:border-cyan hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.shareTitle}</h2>
        <p className="mt-2 text-sm text-muted">{t.settings.shareHint}</p>
        {share?.active && share.url ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.shareLink}</span>
              <input
                readOnly
                className="mt-2 h-12 w-full border border-line bg-background px-3 text-sm text-foreground outline-none"
                value={share.url}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => void copyShareLink()}
                className="h-11 border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
              >
                {t.settings.shareCopy}
              </button>
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => void createShare(true)}
                className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
              >
                {t.settings.shareRotate}
              </button>
            </div>
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => void revokeShareLink()}
              className="h-11 w-full border border-line text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-60"
            >
              {t.settings.shareRevoke}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={shareBusy || share == null}
            onClick={() => void createShare(false)}
            className="mt-4 h-12 w-full border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
          >
            {shareBusy || share == null ? t.settings.shareLoading : t.settings.shareCreate}
          </button>
        )}
        {shareNote ? (
          <p className="mt-3 text-sm text-muted" role="status">
            {shareNote}
          </p>
        ) : null}
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.collectionDefaults}</h2>
        <p className="mt-2 text-sm text-muted">{t.settings.collectionDefaultsHint}</p>

        <div className="mt-4 space-y-4">
          <Field
            label={t.settings.defaultCurrency}
            hint={t.settings.defaultCurrencyHint}
            value={prefs.currency}
            onChange={(value) => patchPref("currency", value as UserPreferences["currency"])}
            options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          />
          <Field
            label={t.settings.defaultCondition}
            hint={t.settings.defaultConditionHint}
            value={prefs.condition}
            onChange={(value) => patchPref("condition", value)}
            options={CONDITIONS.map((condition) => ({
              value: condition.code,
              label: `${condition.code} — ${condition.name}`,
            }))}
          />
          <Field
            label={t.settings.defaultSort}
            hint={t.settings.defaultSortHint}
            value={prefs.sort}
            onChange={(value) => patchPref("sort", value as SortKey)}
            options={sorts}
          />
          <Field
            label={t.settings.defaultCollection}
            hint={t.settings.defaultCollectionHint}
            value={prefs.collection}
            onChange={(value) => patchPref("collection", value as CollectionFilter)}
            options={collectionOptions}
          />
          <Field
            label={t.settings.filtersPanel}
            hint={t.settings.filtersPanelHint}
            value={prefs.filtersPanel}
            onChange={(value) => patchPref("filtersPanel", value as FiltersPanelMode)}
            options={panelOptions}
          />
        </div>

        <button
          type="button"
          onClick={() => resetPrefs()}
          className="mt-4 h-10 w-full border border-line text-sm text-muted hover:border-cyan hover:text-cyan"
        >
          {t.settings.resetDefaults}
        </button>
      </section>

      <OfflineSection catalog={catalog} />

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t.settings.data}</h2>
        <p className="mt-2 text-sm text-muted">{t.settings.dataHint}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!catalog}
            onClick={() => exportCollection("csv")}
            className="h-12 border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
          >
            {t.settings.exportCsv}
          </button>
          <button
            type="button"
            onClick={() => exportCollection("json")}
            className="h-12 border border-line text-sm text-muted hover:border-cyan hover:text-cyan"
          >
            {t.settings.exportJson}
          </button>
        </div>
        {exportNote ? (
          <p className="mt-3 text-sm text-muted" role="status">
            {exportNote}
          </p>
        ) : null}

        <h3 className="mt-6 text-xs uppercase tracking-[0.14em] text-muted">{t.settings.importTitle}</h3>
        <p className="mt-2 text-sm text-muted">{t.settings.importHint}</p>
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
                ? t.settings.importFormatApp
                : importPreview.format === "cardmarket"
                  ? t.settings.importFormatCardmarket
                  : t.settings.importFormatGeneric}
            </p>
            <p className="text-foreground">
              {t.settings.importSummary(formatInt(importPreview.lines.length), formatInt(importPreview.copies))}
            </p>
            {importPreview.format === "cardmarket" ? (
              <p className="text-xs text-muted">{t.settings.importCardmarketPrice}</p>
            ) : null}
            <IssueList
              title={t.settings.importGuessed(formatInt(importPreview.guessed.length))}
              issues={importPreview.guessed}
              more={t.settings.importMore}
              tone="text-yellow"
            />
            <IssueList
              title={t.settings.importRejected(formatInt(importPreview.rejected.length))}
              issues={importPreview.rejected}
              more={t.settings.importMore}
              reason={issueReason}
              tone="text-danger"
            />
            <fieldset className="space-y-2">
              {(
                [
                  { value: "add", label: t.settings.importModeAdd },
                  { value: "set", label: t.settings.importModeSet },
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
                {importBusy ? t.settings.importing : t.settings.importConfirm}
              </button>
              <button
                type="button"
                disabled={importBusy}
                onClick={() => setImportPreview(null)}
                className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
              >
                {t.settings.importCancel}
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
              {importBusy ? t.settings.importReading : t.settings.importChoose}
            </button>
            {importPreview && importPreview.rejected.length > 0 ? (
              <div className="mt-3 text-sm">
                <IssueList
                  title={t.settings.importRejected(formatInt(importPreview.rejected.length))}
                  issues={importPreview.rejected}
                  more={t.settings.importMore}
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
      </section>

      {error ? (
        <p className="mt-6 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={pending}
        className="mt-8 h-12 w-full border border-line text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-60"
      >
        {pending ? t.settings.loggingOut : t.settings.logout}
      </button>
    </div>
  );
}

const MAX_LISTED_ISSUES = 8;

function IssueList({
  title,
  issues,
  more,
  reason,
  tone,
}: {
  title: string;
  issues: ImportIssue[];
  more: (n: string) => string;
  reason?: (issue: ImportIssue) => string;
  tone: string;
}) {
  if (issues.length === 0) return null;
  const hidden = issues.length - MAX_LISTED_ISSUES;
  return (
    <div>
      <p className={tone}>{title}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted">
        {issues.slice(0, MAX_LISTED_ISSUES).map((issue) => (
          <li key={issue.row}>
            L{issue.row} · {issue.label}
            {reason ? ` — ${reason(issue)}` : null}
          </li>
        ))}
        {hidden > 0 ? <li>{more(formatInt(hidden))}</li> : null}
      </ul>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <select
        className="mt-2 h-12 w-full border border-line bg-background px-3 text-base outline-none focus:border-cyan"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
