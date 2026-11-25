"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { OfflineSection } from "@/components/OfflineSection";
import { usePreferences } from "@/components/PreferencesProvider";
import { PushSettingsSection } from "@/components/PushNotifications";
import { DataSection } from "@/components/settings/DataSection";
import { DefaultsSection } from "@/components/settings/DefaultsSection";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import { ShareSection } from "@/components/settings/ShareSection";
import { SkeletonBlock } from "@/components/site/ScreenSkeleton";
import { LANGUAGES, type Locale } from "@/i18n/config";
import { chooseLocale } from "@/i18n/choose-locale";

export function SettingsScreen() {
  const { user, logout, catalog, pendingCount } = useCollection();
  const t = useTranslations();
  const locale = useLocale();
  const { prefs, setPrefs } = usePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Rendu aussi avant la vérification de session (page Paramètres) : seuls le nom et l'e-mail attendent le compte.
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t("settings.eyebrow")}</p>
      <h1 className="mt-1 text-3xl text-yellow">{t("settings.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("settings.subtitle")}</p>

      <dl className="mt-8 space-y-4 border-t border-line pt-6">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.displayName")}</dt>
          <dd className="mt-1 text-base text-foreground">{user ? user.displayName : <SkeletonBlock className="h-6 w-40" />}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">{t("settings.email")}</dt>
          <dd className="mt-1 break-all text-base text-foreground">{user ? user.email : <SkeletonBlock className="h-6 w-56" />}</dd>
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
                onClick={() => setPrefs({ theme: option.value })}
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

      <ShareSection />

      <DefaultsSection />

      <PushSettingsSection />

      <OfflineSection catalog={catalog} />

      <DataSection />

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

      <DeleteAccountSection />
    </div>
  );
}
