"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";

type NavIcon = "dashboard" | "cards" | "investment" | "howto" | "binder";

type NavLink = { href: string; label: string; match: string; icon: NavIcon };

function useNavigation() {
  const pathname = usePathname();
  const { cardsHref } = useBrowseSelection();
  const { user, ready } = useCollection();
  const { t } = useI18n();
  const sharedMatch = pathname.match(/^\/classeur\/([^/]+)/);
  const isSharedView = Boolean(sharedMatch);
  const shareToken = sharedMatch?.[1] ?? null;
  const showNav = isSharedView || (ready && Boolean(user));

  const links: NavLink[] = isSharedView && shareToken
    ? [
        { href: `/classeur/${shareToken}`, label: t.share.binderNav, match: `/classeur/${shareToken}`, icon: "binder" },
        {
          href: `/classeur/${shareToken}/cartes`,
          label: t.nav.cards,
          match: `/classeur/${shareToken}/cartes`,
          icon: "cards",
        },
      ]
    : [
        { href: "/", label: t.nav.dashboard, match: "/", icon: "dashboard" },
        { href: cardsHref, label: t.nav.cards, match: "/cards", icon: "cards" },
        { href: "/investissement", label: t.nav.investment, match: "/investissement", icon: "investment" },
        { href: "/comment-jouer", label: t.nav.howto, match: "/comment-jouer", icon: "howto" },
      ];

  return { pathname, user, t, isSharedView, shareToken, showNav, links };
}

export function Header() {
  const { pathname, user, t, isSharedView, shareToken, showNav, links } = useNavigation();
  // Page d'où l'on a ouvert les paramètres : un second clic sur le bouton y ramène.
  const [settingsReturn, setSettingsReturn] = useState("/");
  const inSettings = pathname === "/parametres";

  const actionClass =
    "inline-flex size-10 shrink-0 items-center justify-center border border-line text-muted hover:border-cyan hover:text-foreground";

  return (
    <header className="pt-safe px-safe relative z-30 shrink-0 border-b border-line bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2">
        <Link href={isSharedView && shareToken ? `/classeur/${shareToken}` : "/"} className="shrink-0 text-sm text-yellow">
          TCG Tracker
        </Link>
        {showNav ? (
          // Sur téléphone, la navigation passe dans la barre d'onglets du bas (BottomNav).
          <nav className="ml-auto hidden border border-line sm:flex" aria-label={t.common.sections}>
            {links.map((link) => {
              const active = pathname === link.match;
              return (
                <Link
                  key={link.match}
                  href={link.href}
                  className={`px-3 py-2 text-sm ${active ? "bg-yellow text-black" : "text-muted hover:text-foreground"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        {user && !isSharedView ? (
          <Link
            href={inSettings ? settingsReturn : "/parametres"}
            onClick={() => {
              if (!inSettings) setSettingsReturn(window.location.pathname + window.location.search);
            }}
            className={`${actionClass} ml-auto sm:ml-0 ${inSettings ? "border-yellow bg-yellow text-black hover:border-yellow hover:text-black" : ""}`}
            aria-label={t.common.settings}
            title={t.common.settings}
            aria-pressed={inSettings}
          >
            <SettingsIcon />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

/** Barre d'onglets façon application, affichée uniquement sur téléphone. */
export function BottomNav() {
  const { pathname, t, showNav, links } = useNavigation();
  const keyboardOpen = useKeyboardOpen();
  const visible = showNav && !keyboardOpen;

  // Les barres fixes (mode ajout…) se placent au-dessus via --app-bottom-nav.
  useEffect(() => {
    document.body.dataset.bottomNav = visible ? "true" : "false";
    return () => {
      delete document.body.dataset.bottomNav;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <nav
      className="pb-safe px-safe relative z-30 shrink-0 border-t border-line bg-background/95 backdrop-blur sm:hidden"
      aria-label={t.common.sections}
    >
      <ul className="flex h-[3.75rem]">
        {links.map((link) => {
          const active = pathname === link.match;
          return (
            <li key={link.match} className="min-w-0 flex-1">
              <Link
                href={link.href}
                className={`relative flex h-full flex-col items-center justify-center gap-1 px-1 ${
                  active ? "text-yellow" : "text-muted active:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {active ? <span className="absolute inset-x-4 top-0 h-0.5 bg-yellow" aria-hidden="true" /> : null}
                <NavGlyph icon={link.icon} />
                <span className="max-w-full truncate text-[11px] leading-none">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Vrai quand un champ texte a le focus sur écran tactile, donc que le clavier virtuel est ouvert. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const isField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
      if (target.tagName !== "INPUT") return false;
      const type = (target as HTMLInputElement).type;
      return !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color"].includes(type);
    };
    const onFocusIn = (event: FocusEvent) => setOpen(isField(event.target));
    const onFocusOut = (event: FocusEvent) => {
      if (!isField(event.relatedTarget)) setOpen(false);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return open;
}

function NavGlyph({ icon }: { icon: NavIcon }) {
  const common = {
    "aria-hidden": true,
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
  } as const;
  switch (icon) {
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      );
    case "cards":
      return (
        <svg {...common}>
          <path d="M8 3.5h11v15H8z" />
          <path d="M5 6.5v14h11" />
        </svg>
      );
    case "investment":
      return (
        <svg {...common}>
          <path d="M3.5 20.5h17" />
          <path d="m4.5 15.5 5-5 4 3.5 6-7" />
          <path d="M15.5 7h4v4" />
        </svg>
      );
    case "howto":
      return (
        <svg {...common}>
          <path d="M4 5.5c3-1.5 5.5-1.5 8 0v14c-2.5-1.5-5-1.5-8 0z" />
          <path d="M12 5.5c2.5-1.5 5-1.5 8 0v14c-3-1.5-5.5-1.5-8 0" />
        </svg>
      );
    case "binder":
      return (
        <svg {...common}>
          <path d="M5 3.5h13v17H5z" />
          <path d="M8.5 3.5v17M11.5 8h4M11.5 11.5h4" />
        </svg>
      );
  }
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  );
}
