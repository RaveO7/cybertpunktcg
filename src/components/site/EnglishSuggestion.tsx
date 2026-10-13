"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n/messages";
import { alternatePath } from "@/lib/seo/routes";

const DISMISS_KEY = "cptcg-en-suggestion-dismissed";

/** Visiteur non francophone d'une page publique française : lien vers la version anglaise, sans redirection. */
function wantsEnglish(): boolean {
  try {
    if (window.localStorage.getItem(DISMISS_KEY)) return false;
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return stored !== "fr";
  } catch {
    // stockage indisponible : on se fie au navigateur
  }
  return !navigator.languages.some((language) => language.toLowerCase().startsWith("fr"));
}

export function EnglishSuggestion() {
  const { routeLocale, setLocale } = useI18n();
  const pathname = usePathname();
  // Affiché seulement après montage : le HTML servi aux robots n'en contient rien.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(routeLocale === "fr" && wantsEnglish()), 0);
    return () => window.clearTimeout(id);
  }, [routeLocale, pathname]);

  const target = routeLocale === "fr" ? alternatePath(pathname, null, "en") : null;
  if (!visible || !target) return null;

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div lang="en" className="flex items-center justify-center gap-3 border-b border-line bg-cyan/10 px-4 py-2 text-sm" role="note">
      <span className="text-muted">This page is available in English.</span>
      <a
        href={target}
        hrefLang="en"
        onClick={(event) => {
          event.preventDefault();
          setLocale("en");
        }}
        className="text-cyan underline"
      >
        English version
      </a>
      <button type="button" onClick={dismiss} className="ml-1 px-2 text-muted hover:text-foreground" aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
