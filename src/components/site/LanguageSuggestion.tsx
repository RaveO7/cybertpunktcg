"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { COUNTRY_COOKIE, suggestedSiteLocale } from "@/lib/i18n/geo-locale";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n/messages";
import { alternatePath, type SiteLocale } from "@/lib/seo/routes";

const COPY: Record<SiteLocale, { text: string; link: string; dismiss: string }> = {
  fr: { text: "Cette page existe en français.", link: "Version française", dismiss: "Fermer" },
  en: { text: "This page is available in English.", link: "English version", dismiss: "Dismiss" },
};

/** Bandeau refusé pour cette langue (la clé anglaise reprend celle de l'ancien bandeau). */
function dismissKey(locale: SiteLocale) {
  return `cptcg-${locale}-suggestion-dismissed`;
}

function readCookie(name: string): string | null {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

/** Langue à proposer d'après la langue choisie, le pays de connexion et le navigateur ; null si refusée. */
function readSuggestion(): SiteLocale | null {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // stockage indisponible : pays et navigateur décident
  }
  const suggested = suggestedSiteLocale({ stored, country: readCookie(COUNTRY_COOKIE), languages: navigator.languages });
  try {
    if (window.localStorage.getItem(dismissKey(suggested))) return null;
  } catch {
    // ignore
  }
  return suggested;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Page publique bilingue lue dans l'autre langue que celle du visiteur (pays de connexion, à défaut
 * navigateur) : lien vers la version de sa langue, sans redirection. Rendu dès l'hydratation, mais
 * absent du HTML servi : les robots ne le voient pas dans la page statique.
 */
export function LanguageSuggestion() {
  const { routeLocale, setLocale } = useI18n();
  const pathname = usePathname();
  const suggestion = useSyncExternalStore(subscribe, readSuggestion, () => null);
  const [dismissed, setDismissed] = useState<SiteLocale | null>(null);

  if (!routeLocale || !suggestion || suggestion === routeLocale || dismissed === suggestion) return null;
  const target = alternatePath(pathname, null, suggestion);
  if (!target) return null;
  const copy = COPY[suggestion];

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
      <span className="text-muted">{copy.text}</span>
      <a
        href={target}
        hrefLang={suggestion}
        onClick={(event) => {
          event.preventDefault();
          setLocale(suggestion);
        }}
        className="text-cyan underline"
      >
        {copy.link}
      </a>
      <button type="button" onClick={dismiss} className="ml-1 px-2 text-muted hover:text-foreground" aria-label={copy.dismiss}>
        ×
      </button>
    </div>
  );
}
