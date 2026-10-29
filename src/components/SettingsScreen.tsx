"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import type { Translator } from "@/i18n/translator";
import { useCollection } from "@/components/CollectionProvider";
import { useCachedJson } from "@/components/data-cache";
import { OfflineSection } from "@/components/OfflineSection";
import { usePreferences } from "@/components/PreferencesProvider";
import { PushSettingsSection } from "@/components/PushNotifications";
import { ScreenSkeleton, SkeletonBlock } from "@/components/site/ScreenSkeleton";
import { useRouter } from "@/i18n/navigation";
import {
  CollectionCsvError,
  collectionToCsv,
  parseCollectionCsv,
  type ImportIssue,
  type ImportPreview,
} from "@/lib/collection-csv";
import { LANGUAGES, type Locale } from "@/i18n/config";
import { chooseLocale } from "@/i18n/choose-locale";
import { CURRENCIES } from "@/lib/parse";
import { CONDITIONS } from "@/lib/reference-data";
import type { FiltersPanelMode, UserPreferences } from "@/lib/preferences";
import type { CollectionFilter, SortKey } from "@/lib/types";

type ShareState = {
  active: boolean;
  url?: string;
  createdAt?: string;
};

const SHARE_URL = "/api/share";
const NO_SHARE: ShareState = { active: false };

function sortOptions(t: Translator): { value: SortKey; label: string }[] {
  return [
    { value: "default", label: t("cards.sortDefault") },
    { value: "number-asc", label: t("cards.sortNumberAsc") },
    { value: "number-desc", label: t("cards.sortNumberDesc") },
    { value: "price-asc", label: t("cards.sortPriceAsc") },
    { value: "price-desc", label: t("cards.sortPriceDesc") },
    { value: "play-cost-asc", label: t("cards.sortPlayCostAsc") },
    { value: "play-cost-desc", label: t("cards.sortPlayCostDesc") },
    { value: "power-asc", label: t("cards.sortPowerAsc") },
    { value: "power-desc", label: t("cards.sortPowerDesc") },
    { value: "ram-asc", label: t("cards.sortRamAsc") },
    { value: "ram-desc", label: t("cards.sortRamDesc") },
    { value: "qty-asc", label: t("cards.sortQtyAsc") },
    { value: "qty-desc", label: t("cards.sortQtyDesc") },
    { value: "name-asc", label: t("cards.sortNameAsc") },
    { value: "name-desc", label: t("cards.sortNameDesc") },
    { value: "rarity", label: t("cards.sortRarity") },
    { value: "set", label: t("cards.groupSet") },
    { value: "owned-first", label: t("cards.groupOwnedFirst") },
    { value: "missing-first", label: t("cards.groupMissingFirst") },
  ];
}

export function SettingsScreen() {
  const fmt = useNumberFormat();
  const { user, ready, logout, deleteAccount, items, catalog, importLines, pendingCount } = useCollection();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { prefs, setPrefs, resetPrefs } = usePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  // État du partage : copie en cache affichée aussitôt, rechargée à chaque visite.
  const shareQuery = useCachedJson<ShareState>(user ? SHARE_URL : null);
  const share = shareQuery.data ?? (shareQuery.error ? NO_SHARE : null);
  const setShare = (next: ShareState) => shareQuery.mutate(() => next);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<"add" | "set">("add");
  const [importBusy, setImportBusy] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const sorts = useMemo(() => sortOptions(t), [t]);

  const collectionOptions: { value: CollectionFilter; label: string }[] = [
    { value: "all", label: t("filters.allCards") },
    { value: "owned", label: t("filters.owned") },
    { value: "missing", label: t("filters.missing") },
    { value: "duplicates", label: t("filters.duplicates") },
  ];

  const panelOptions: { value: FiltersPanelMode; label: string }[] = [
    { value: "auto", label: t("settings.filtersPanelAuto") },
    { value: "open", label: t("settings.filtersPanelOpen") },
    { value: "closed", label: t("settings.filtersPanelClosed") },
  ];

  async function onLogout() {
    // Modifications faites hors ligne pas encore envoyées : perdues à la déconnexion.
    if (pendingCount > 0 && !window.confirm(t("offline.sync.logoutConfirm", { n: pendingCount }))) return;
    setPending(true);
    setError(null);
    try {
      await logout();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("settings.logoutFailed"));
    } finally {
      setPending(false);
    }
  }

  async function onDeleteAccount() {
    setDeleteStep("busy");
    setDeleteError(null);
    try {
      await deleteAccount();
      router.replace("/");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : t("settings.deleteFailed"));
      setDeleteStep("confirm");
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
      setExportNote(t("settings.exportDone"));
    } catch {
      setExportNote(t("settings.exportFailed"));
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
      if (!response.ok) throw new Error(body.error || t("settings.shareFailed"));
      setShare(body);
      setShareNote(rotate ? t("settings.shareRotated") : t("settings.shareCreated"));
    } catch (caught) {
      setShareNote(caught instanceof Error ? caught.message : t("settings.shareFailed"));
    } finally {
      setShareBusy(false);
    }
  }

  async function revokeShareLink() {
    setShareBusy(true);
    setShareNote(null);
    try {
      const response = await fetch("/api/share", { method: "DELETE" });
      if (!response.ok) throw new Error(t("settings.shareFailed"));
      setShare({ active: false });
      setShareNote(t("settings.shareRevoked"));
    } catch (caught) {
      setShareNote(caught instanceof Error ? caught.message : t("settings.shareFailed"));
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!share?.url) return;
    setShareNote(null);
    try {
      await navigator.clipboard.writeText(share.url);
      setShareNote(t("settings.shareCopied"));
    } catch {
      setShareNote(t("settings.shareCopyFailed"));
    }
  }

  function patchPref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs({ [key]: value } as Partial<UserPreferences>);
  }

  if (!ready) return <SettingsSkeleton />;

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t("settings.eyebrow")}</p>
      <h1 className="mt-1 text-3xl text-yellow">{t("settings.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("settings.subtitle")}</p>

      <dl className="mt-8 space-y-4 border-t border-line pt-6">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.displayName")}</dt>
          <dd className="mt-1 text-base text-foreground">{user.displayName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.email")}</dt>
          <dd className="mt-1 break-all text-base text-foreground">{user.email}</dd>
        </div>
      </dl>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.language")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settings.languageHint")}</p>
        <label className="mt-4 block text-sm">
          <span className="sr-only">{t("settings.language")}</span>
          <select
            className="h-12 w-full border border-line bg-background px-3 text-base outline-none focus:border-cyan"
            value={locale}
            aria-label={t("settings.language")}
            onChange={(event) => chooseLocale(event.target.value as Locale)}
          >
            {LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code} lang={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.theme")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settings.themeHint")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              { value: "dark", label: t("settings.themeDark") },
              { value: "light", label: t("settings.themeLight") },
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
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.shareTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settings.shareHint")}</p>
        {share?.active && share.url ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.shareLink")}</span>
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
                {t("settings.shareCopy")}
              </button>
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => void createShare(true)}
                className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
              >
                {t("settings.shareRotate")}
              </button>
            </div>
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => void revokeShareLink()}
              className="h-11 w-full border border-line text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-60"
            >
              {t("settings.shareRevoke")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={shareBusy || share == null}
            onClick={() => void createShare(false)}
            className="mt-4 h-12 w-full border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
          >
            {shareBusy || share == null ? t("settings.shareLoading") : t("settings.shareCreate")}
          </button>
        )}
        {shareNote ? (
          <p className="mt-3 text-sm text-muted" role="status">
            {shareNote}
          </p>
        ) : null}
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.collectionDefaults")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settings.collectionDefaultsHint")}</p>

        <div className="mt-4 space-y-4">
          <Field
            label={t("settings.defaultCurrency")}
            hint={t("settings.defaultCurrencyHint")}
            value={prefs.currency}
            onChange={(value) => patchPref("currency", value as UserPreferences["currency"])}
            options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          />
          <Field
            label={t("settings.defaultCondition")}
            hint={t("settings.defaultConditionHint")}
            value={prefs.condition}
            onChange={(value) => patchPref("condition", value)}
            options={CONDITIONS.map((condition) => ({
              value: condition.code,
              label: `${condition.code} — ${condition.name}`,
            }))}
          />
          <Field
            label={t("settings.defaultSort")}
            hint={t("settings.defaultSortHint")}
            value={prefs.sort}
            onChange={(value) => patchPref("sort", value as SortKey)}
            options={sorts}
          />
          <Field
            label={t("settings.defaultCollection")}
            hint={t("settings.defaultCollectionHint")}
            value={prefs.collection}
            onChange={(value) => patchPref("collection", value as CollectionFilter)}
            options={collectionOptions}
          />
          <Field
            label={t("settings.filtersPanel")}
            hint={t("settings.filtersPanelHint")}
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
          {t("settings.resetDefaults")}
        </button>
      </section>

      <PushSettingsSection />

      <OfflineSection catalog={catalog} />

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
        {pending ? t("settings.loggingOut") : t("settings.logout")}
      </button>

      <section className="mt-10 border-t border-line pt-6" aria-labelledby="delete-account-title">
        <h2 id="delete-account-title" className="text-xs uppercase tracking-[0.14em] text-danger">
          {t("settings.deleteTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("settings.deleteHint")}</p>
        {deleteStep === "idle" ? (
          <button
            type="button"
            onClick={() => setDeleteStep("confirm")}
            className="mt-4 h-12 w-full border border-danger/60 text-sm text-danger hover:bg-danger/10"
          >
            {t("settings.deleteStart")}
          </button>
        ) : (
          <div className="mt-4 space-y-3 border border-danger/60 p-4">
            <p className="text-sm text-foreground">{t("settings.deleteConfirmText", { email: user.email })}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={deleteStep === "busy"}
                onClick={() => void onDeleteAccount()}
                className="h-11 border border-danger bg-danger/10 text-sm text-danger hover:bg-danger/20 disabled:opacity-60"
              >
                {deleteStep === "busy" ? t("settings.deleting") : t("settings.deleteConfirm")}
              </button>
              <button
                type="button"
                disabled={deleteStep === "busy"}
                onClick={() => {
                  setDeleteStep("idle");
                  setDeleteError(null);
                }}
                className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
              >
                {t("settings.deleteCancel")}
              </button>
            </div>
          </div>
        )}
        {deleteError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {deleteError}
          </p>
        ) : null}
      </section>
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
  const fmt = useNumberFormat();
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
        {hidden > 0 ? <li>{more(fmt.int(hidden))}</li> : null}
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

/** Squelette des réglages : titre, compte, puis les sections. */
function SettingsSkeleton() {
  const t = useTranslations();
  return (
    <ScreenSkeleton label={t("settings.loading")} className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-9 w-48" />
        <SkeletonBlock className="h-4 w-full" />
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 border-t border-line pt-6">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      ))}
    </ScreenSkeleton>
  );
}
