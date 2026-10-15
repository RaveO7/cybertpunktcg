"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { chooseLocale } from "@/i18n/choose-locale";
import { alternatePath } from "@/i18n/paths";
import { isLocaleSwitching, readLocalePreference, subscribeLocalePreference } from "@/i18n/preference";
import { COUNTRY_COOKIE, languageSuggestion } from "@/lib/i18n/geo-locale";

/** Textes du bandeau dans chaque langue (bloc languageSuggestion) : il s'affiche dans la langue proposée. */
export type SuggestionCopy = Record<Locale, { text: string; link: string; dismiss: string }>;

/** Bandeau refusé pour cette langue. */
function dismissKey(locale: Locale) {
  return `cptcg-${locale}-suggestion-dismissed`;
}

function isDismissed(locale: Locale) {
  try {
    return Boolean(window.localStorage.getItem(dismissKey(locale)));
  } catch {
    return false;
  }
}

function readCookie(name: string): string | null {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  const unsubscribe = subscribeLocalePreference(onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    unsubscribe();
  };
}

/**
 * Page lue dans une autre langue que celle du visiteur (langue choisie, sinon pays de connexion, sinon
 * navigateur, sinon anglais) : lien vers la même page dans sa langue, sans redirection. Rendu dès
 * l'hydratation mais absent du HTML servi : les robots ne le voient pas. Masqué pendant un changement
 * de langue.
 */
export function LanguageSuggestion({ copy }: { copy: SuggestionCopy }) {
  const locale = useLocale();
  const pathname = usePathname();
  const suggestion = useSyncExternalStore(
    subscribe,
    () =>
      isLocaleSwitching()
        ? null
        : languageSuggestion({
            current: locale,
            preference: readLocalePreference(),
            country: readCookie(COUNTRY_COOKIE),
            languages: navigator.languages,
            dismissed: isDismissed,
          }),
    () => null,
  );
  const [dismissed, setDismissed] = useState<Locale | null>(null);

  if (!suggestion || dismissed === suggestion) return null;
  const target = alternatePath(pathname, null, suggestion);
  if (!target) return null;
  const text = copy[suggestion];

  function dismiss() {
    if (!suggestion) return;
    setDismissed(suggestion);
    try {
      window.localStorage.setItem(dismissKey(suggestion), "1");
    } catch {
      // ignore
    }
  }

  return (
    <div lang={suggestion} className="flex items-center justify-center gap-3 border-b border-line bg-cyan/10 px-4 py-2 text-sm" role="note">
      <span className="text-muted">{text.text}</span>
      <a
        href={target}
        hrefLang={suggestion}
        onClick={(event) => {
          event.preventDefault();
          chooseLocale(suggestion);
        }}
        className="text-cyan underline"
      >
        {text.link}
      </a>
      <button type="button" onClick={dismiss} className="ml-1 px-2 text-muted hover:text-foreground" aria-label={text.dismiss}>
        ×
      </button>
    </div>
  );
}
