"use client";

import NextLink from "next/link";
import { usePathname as useBrowserPathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection } from "@/components/CollectionProvider";
import { chooseLocale } from "@/i18n/choose-locale";
import { LANGUAGES, type Locale } from "@/i18n/config";
import { Link, useRouter, type Href } from "@/i18n/navigation";
import { useInternalPathname } from "@/i18n/useInternalPathname";
import { isInHorizontalScroller } from "@/lib/swipe";

type NavIcon = "dashboard" | "cards" | "investment" | "decks" | "tournaments" | "wishlist" | "howto" | "binder";

type NavLink = { href: Href; label: string; match: string; icon: NavIcon; badge?: number };

function useNavigation() {
  // Chemin interne (segments français, sans préfixe de langue) : repère l'onglet actif dans toutes les langues.
  const pathname = useInternalPathname();
  const { cardsHref } = useBrowseSelection();
  const { user, ready } = useCollection();
  const t = useTranslations();
  const sharedMatch = pathname.match(/^\/classeur\/([^/]+)/);
  const isSharedView = Boolean(sharedMatch);
  const shareToken = sharedMatch?.[1] ?? null;
  const showNav = isSharedView || (ready && Boolean(user));

  const links: NavLink[] = isSharedView && shareToken
    ? [
        {
          href: { pathname: "/classeur/[token]", params: { token: shareToken } },
          label: t("share.binderNav"),
          match: `/classeur/${shareToken}`,
          icon: "binder",
        },
        {
          href: { pathname: "/classeur/[token]/cartes", params: { token: shareToken } },
          label: t("nav.cards"),
          match: `/classeur/${shareToken}/cartes`,
          icon: "cards",
        },
      ]
    : [
        { href: "/", label: t("nav.dashboard"), match: "/", icon: "dashboard" },
        { href: cardsHref, label: t("nav.cards"), match: "/cards", icon: "cards" },
        { href: "/investissement", label: t("nav.investment"), match: "/investissement", icon: "investment" },
        { href: "/decks", label: t("nav.decks"), match: "/decks", icon: "decks" },
        { href: "/tournois", label: t("nav.tournaments"), match: "/tournois", icon: "tournaments" },
        // Page /souhaits masquée pour l'instant. Pour la réafficher, lire `const { unseenAlerts } = useWishlist();`
        // en haut du hook puis ajouter :
        // { href: "/souhaits", label: t.nav.wishlist, match: "/souhaits", icon: "wishlist", badge: unseenAlerts },
        { href: "/comment-jouer", label: t("nav.howto"), match: "/comment-jouer", icon: "howto" },
      ];

  return { pathname, user, t, isSharedView, shareToken, showNav, links };
}

/**
 * Choix de la langue parmi toutes celles du site. Sur une page publique, mène à la même page dans la
 * langue choisie ; ailleurs, change la langue de l'application. Le `<select>` natif, transparent,
 * couvre le bouton affiché : clavier, lecteurs d'écran et sélecteur du téléphone fonctionnent tels quels.
 */
function LanguageSelect() {
  const t = useTranslations();
  const current = useLocale();
  return (
    <label className="relative inline-flex h-9 shrink-0 items-center gap-1 border border-line px-2 font-mono text-xs uppercase text-muted focus-within:border-cyan hover:border-cyan hover:text-foreground">
      <span aria-hidden="true">{current}</span>
      <svg viewBox="0 0 10 6" className="h-1.5 w-2.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 1l4 4 4-4" />
      </svg>
      <select
        value={current}
        onChange={(event) => {
          const next = event.target.value as Locale;
          if (next !== current) chooseLocale(next);
        }}
        aria-label={t("nav.language")}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {LANGUAGES.map((entry) => (
          <option key={entry.code} value={entry.code} lang={entry.code}>
            {entry.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Barre des visiteurs sans compte : tout est sur l'accueil, donc seulement la langue et la connexion. */
function VisitorNav() {
  const t = useTranslations();
  // Retour après connexion : l'URL affichée, dans sa langue.
  const next = useBrowserPathname();
  return (
    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-1">
      <LanguageSelect />
      <Link href={{ pathname: "/connexion", query: { next } }} rel="nofollow" className="inline-flex h-9 items-center border border-cyan px-3 text-sm text-cyan hover:bg-cyan/10">
        {t("nav.login")}
      </Link>
    </div>
  );
}

export function Header() {
  const { pathname, user, t, isSharedView, shareToken, showNav, links } = useNavigation();
  // Visiteur sur une page publique (aussi au rendu serveur, pour les liens internes) : navigation publique.
  const showVisitorNav = !user && !isSharedView && !showNav && pathname !== "/connexion";
  // Page d'où l'on a ouvert les paramètres (URL complète, dans sa langue) : un second clic y ramène.
  const [settingsReturn, setSettingsReturn] = useState<string | null>(null);
  const inSettings = pathname === "/parametres";

  const actionClass =
    "inline-flex size-10 shrink-0 items-center justify-center border border-line text-muted hover:border-cyan hover:text-foreground";

  return (
    <header className="pt-safe px-safe relative z-30 shrink-0 border-b border-line bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2">
        <Link
          href={isSharedView && shareToken ? { pathname: "/classeur/[token]", params: { token: shareToken } } : "/"}
          className="shrink-0 text-sm text-yellow"
        >
          TCG Tracker
        </Link>
        {showNav ? (
          // Sur téléphone, la navigation passe dans la barre d'onglets du bas (BottomNav).
          <nav className="ml-auto hidden border border-line sm:flex" aria-label={t("common.sections")}>
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
                  <NavBadge count={link.badge} label={(n) => t("wishlist.newAlerts", { n })} />
                </Link>
              );
            })}
          </nav>
        ) : showVisitorNav ? (
          <VisitorNav />
        ) : null}
        {user && !isSharedView ? (
          inSettings && settingsReturn ? (
            <NextLink
              href={settingsReturn}
              className={`${actionClass} ml-auto border-yellow bg-yellow text-black hover:border-yellow hover:text-black sm:ml-0`}
              aria-label={t("common.settings")}
              title={t("common.settings")}
              aria-pressed
            >
              <SettingsIcon />
            </NextLink>
          ) : (
            <Link
              href={inSettings ? "/" : "/parametres"}
              onClick={() => {
                if (!inSettings) setSettingsReturn(window.location.pathname + window.location.search);
              }}
              className={`${actionClass} ml-auto sm:ml-0 ${inSettings ? "border-yellow bg-yellow text-black hover:border-yellow hover:text-black" : ""}`}
              aria-label={t("common.settings")}
              title={t("common.settings")}
              aria-pressed={inSettings}
            >
              <SettingsIcon />
            </Link>
          )
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
  usePageSwipe(links, pathname, visible);

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
      aria-label={t("common.sections")}
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
                <span className="relative">
                  <NavGlyph icon={link.icon} />
                  <NavBadge count={link.badge} label={(n) => t("wishlist.newAlerts", { n })} floating />
                </span>
                <span className="max-w-full truncate text-[11px] leading-none">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Téléphone : balayer l'écran vers la gauche/droite passe à l'onglet suivant/précédent de la barre du bas.
 * Ignoré dans les champs, les fenêtres modales, les zones défilant horizontalement ou ayant leurs
 * propres balayages (`data-swipe-zone`), et près des bords (geste « retour » du système).
 */
function usePageSwipe(links: NavLink[], pathname: string, enabled: boolean) {
  const router = useRouter();
  const index = links.findIndex((link) => link.match === pathname);
  const prevHref = index > 0 ? links[index - 1].href : null;
  const nextHref = index >= 0 && index < links.length - 1 ? links[index + 1].href : null;

  useEffect(() => {
    if (!enabled || (!prevHref && !nextHref)) return;
    const phone = window.matchMedia("(max-width: 639px)");
    let start: { x: number; y: number; time: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1 || !phone.matches) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("input, textarea, select, [contenteditable], [role=dialog], [data-swipe-zone]")) return;
      if (document.querySelector("[aria-modal=true]") || isInHorizontalScroller(target)) return;
      const touch = event.touches[0];
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
    };

    const onTouchEnd = (event: TouchEvent) => {
      const origin = start;
      start = null;
      if (!origin || event.timeStamp - origin.time > 800) return;
      if (window.getSelection()?.toString()) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const href = dx < 0 ? nextHref : prevHref;
      if (href) router.push(href);
    };

    const onTouchCancel = () => {
      start = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, prevHref, nextHref, router]);
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

/** Pastille du nombre d'alertes de prix non vues. */
function NavBadge({ count, label, floating = false }: { count?: number; label: (n: number) => string; floating?: boolean }) {
  if (!count) return null;
  return (
    <span
      className={`grid h-4 min-w-4 place-items-center bg-danger px-1 font-mono text-[10px] leading-none text-white ${
        floating ? "absolute -right-2.5 -top-1.5" : "ml-1.5 inline-grid align-middle"
      }`}
    >
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label(count)}</span>
    </span>
  );
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
    case "decks":
      return (
        <svg {...common}>
          <path d="M9 6.5h10v14H9z" />
          <path d="M6.5 4.5h10M4.5 8v12.5" />
        </svg>
      );
    case "tournaments":
      return (
        <svg {...common}>
          <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
          <path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.8 10.5M16.5 6h3v1.5a3 3 0 0 1-3.3 3" />
          <path d="M12 13.5v3.5M8.5 20.5h7M9.5 17h5v3.5h-5z" />
        </svg>
      );
    case "wishlist":
      return (
        <svg {...common}>
          <path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
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
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
