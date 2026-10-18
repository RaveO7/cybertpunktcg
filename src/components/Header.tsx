"use client";

import NextLink from "next/link";
import { usePathname as useBrowserPathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection } from "@/components/CollectionProvider";
import { chooseLocale } from "@/i18n/choose-locale";
import { LANGUAGES, type Locale } from "@/i18n/config";
import { Link, useRouter, type Href } from "@/i18n/navigation";
import { useInternalPathname } from "@/i18n/useInternalPathname";
import { isInHorizontalScroller } from "@/lib/swipe";

type NavIcon = "dashboard" | "cards" | "investment" | "decks" | "tournaments" | "wishlist" | "howto" | "binder" | "settings";

// fullPrefetch : page rendue à la demande (tableau de bord), préchargée en entier pour s'ouvrir sans attente.
// Les autres écrans sont statiques, donc déjà préchargés en entier ; les forcer ferait invalider le cache
// du routeur à chaque changement de paramètres d'URL (« ?deck=… »).
type NavLink = { href: Href; label: string; match: string; icon: NavIcon; badge?: number; fullPrefetch?: boolean };

function useNavigation() {
  // Chemin interne (segments français, sans préfixe de langue) : repère l'onglet actif dans toutes les langues.
  const pathname = useInternalPathname();
  const { cardsHref } = useBrowseSelection();
  const { user, session } = useCollection();
  const t = useTranslations();
  const sharedMatch = pathname.match(/^\/classeur\/([^/]+)/);
  const isSharedView = Boolean(sharedMatch);
  const shareToken = sharedMatch?.[1] ?? null;
  const showNav = isSharedView || session === "signed-in";

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
        { href: "/", label: t("nav.dashboard"), match: "/", icon: "dashboard", fullPrefetch: true },
        { href: cardsHref, label: t("nav.cards"), match: "/cards", icon: "cards" },
        { href: "/investissement", label: t("nav.investment"), match: "/investissement", icon: "investment" },
        { href: "/decks", label: t("nav.decks"), match: "/decks", icon: "decks" },
        { href: "/tournois", label: t("nav.tournaments"), match: "/tournois", icon: "tournaments" },
        // Page /souhaits masquée pour l'instant. Pour la réafficher, lire `const { unseenAlerts } = useWishlist();`
        // en haut du hook puis ajouter :
        // { href: "/souhaits", label: t.nav.wishlist, match: "/souhaits", icon: "wishlist", badge: unseenAlerts },
        { href: "/comment-jouer", label: t("nav.howto"), match: "/comment-jouer", icon: "howto" },
      ];

  // Onglet cliqué : affiché comme actif dès le clic, sans attendre l'arrivée de la page. Oublié dès que
  // le chemin change (la page est arrivée).
  const [pending, setPending] = useState<{ from: string; match: string } | null>(null);
  const activeMatch = pending && pending.from === pathname ? pending.match : pathname;
  const markPending = (match: string) => setPending({ from: pathname, match });

  return { pathname, user, t, isSharedView, shareToken, showNav, links, activeMatch, markPending };
}

/**
 * Choix de la langue parmi toutes celles du site. Sur une page publique, mène à la même page dans la
 * langue choisie ; ailleurs, change la langue de l'application. Liste déroulante maison (la liste native
 * ne se laisse pas habiller) : flèches, Début/Fin, Entrée, Échap et première lettre au clavier.
 */
function LanguageSelect() {
  const t = useTranslations();
  const current = useLocale() as Locale;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const currentIndex = Math.max(0, LANGUAGES.findIndex((entry) => entry.code === current));

  const openList = (index = currentIndex) => {
    setActive(index);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    const next = LANGUAGES[index].code;
    close(true);
    if (next !== current) chooseLocale(next);
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = LANGUAGES.length - 1;
    switch (event.key) {
      case "ArrowDown":
        setActive((index) => Math.min(last, index + 1));
        break;
      case "ArrowUp":
        setActive((index) => Math.max(0, index - 1));
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(last);
        break;
      case "Enter":
      case " ":
        choose(active);
        break;
      case "Escape":
        close(true);
        break;
      case "Tab":
        setOpen(false);
        return;
      default: {
        if (event.key.length !== 1) return;
        const letter = event.key.toLowerCase();
        const order = [...LANGUAGES.keys()].map((offset) => (active + 1 + offset) % LANGUAGES.length);
        const match = order.find((index) => LANGUAGES[index].label.toLowerCase().startsWith(letter));
        if (match === undefined) return;
        setActive(match);
      }
    }
    event.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openList();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t("nav.language")} : ${LANGUAGES[currentIndex].label}`}
        className="cp-select"
      >
        <svg viewBox="0 0 16 16" className="size-3.5 text-cyan" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M1.75 8h12.5M8 1.75c-3.2 3.4-3.2 9.1 0 12.5M8 1.75c3.2 3.4 3.2 9.1 0 12.5" />
        </svg>
        <span aria-hidden="true">{current}</span>
        <svg
          viewBox="0 0 10 6"
          className={`h-1.5 w-2.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={t("nav.language")}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKeyDown}
          className="absolute right-0 top-full z-40 mt-1.5 max-h-80 min-w-44 overflow-y-auto border border-cyan/60 bg-[var(--hud-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)] outline-none"
        >
          {LANGUAGES.map((entry, index) => {
            const selected = entry.code === current;
            return (
              <li
                key={entry.code}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                lang={entry.code}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={`relative flex cursor-pointer items-center gap-3 py-2 pl-4 pr-3 text-sm ${
                  index === active ? "bg-panel-2 text-foreground" : selected ? "text-yellow" : "text-muted"
                }`}
              >
                {index === active ? <span className="absolute inset-y-1 left-0 w-0.5 bg-cyan" aria-hidden="true" /> : null}
                <span className={`w-6 font-mono text-xs uppercase ${selected ? "text-yellow" : "text-cyan"}`}>{entry.code}</span>
                <span className={`flex-1 ${selected ? "text-yellow" : ""}`}>{entry.label}</span>
                {selected ? (
                  <svg viewBox="0 0 12 10" className="h-2.5 w-3 text-yellow" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M1 5l3.5 3.5L11 1" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Barre des visiteurs sans compte : tout est sur l'accueil, donc seulement la langue et la connexion. */
function VisitorNav() {
  const t = useTranslations();
  // Retour après connexion : l'URL affichée, dans sa langue.
  const next = useBrowserPathname();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <LanguageSelect />
      <Link href={{ pathname: "/connexion", query: { next } }} rel="nofollow" className="cp-btn cp-btn-sm">
        {t("nav.login")}
      </Link>
    </div>
  );
}

export function Header() {
  const { pathname, user, t, isSharedView, shareToken, showNav, links, activeMatch, markPending } = useNavigation();
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
              const active = activeMatch === link.match;
              return (
                <Link
                  key={link.match}
                  href={link.href}
                  prefetch={link.fullPrefetch}
                  onClick={() => markPending(link.match)}
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
  const { pathname, user, t, isSharedView, showNav, links, activeMatch, markPending } = useNavigation();
  const keyboardOpen = useKeyboardOpen();
  // Page d'où l'on a ouvert les paramètres (URL complète, dans sa langue) : un second clic y ramène.
  const [settingsReturn, setSettingsReturn] = useState<string | null>(null);
  const inSettings = pathname === "/parametres";
  const showSettings = Boolean(user) && !isSharedView;
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
          const active = activeMatch === link.match;
          return (
            <li key={link.match} className="min-w-0 flex-1">
              <Link
                href={link.href}
                prefetch={link.fullPrefetch}
                onClick={() => markPending(link.match)}
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
        {showSettings ? (
          <li className="min-w-0 flex-1">
            {inSettings && settingsReturn ? (
              <NextLink
                href={settingsReturn}
                className="relative flex h-full flex-col items-center justify-center gap-1 px-1 text-yellow"
                aria-current="page"
              >
                <span className="absolute inset-x-4 top-0 h-0.5 bg-yellow" aria-hidden="true" />
                <NavGlyph icon="settings" />
                <span className="max-w-full truncate text-[11px] leading-none">{t("common.settings")}</span>
              </NextLink>
            ) : (
              <Link
                href={inSettings ? "/" : "/parametres"}
                onClick={() => {
                  if (!inSettings) setSettingsReturn(window.location.pathname + window.location.search);
                }}
                className={`relative flex h-full flex-col items-center justify-center gap-1 px-1 ${
                  inSettings ? "text-yellow" : "text-muted active:text-foreground"
                }`}
                aria-current={inSettings ? "page" : undefined}
              >
                {inSettings ? <span className="absolute inset-x-4 top-0 h-0.5 bg-yellow" aria-hidden="true" /> : null}
                <NavGlyph icon="settings" />
                <span className="max-w-full truncate text-[11px] leading-none">{t("common.settings")}</span>
              </Link>
            )}
          </li>
        ) : null}
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
    // Barre réaffichée avec un léger délai : un appui sur un bouton retire le focus du champ avant le
    // clic, et une barre revenue tout de suite sous le doigt recevrait ce clic à la place du bouton.
    let closeTimer: number | undefined;
    // Focus sur un bouton (donné dès l'appui sur Chrome) : la fermeture reste au minuteur du focusout.
    const onFocusIn = (event: FocusEvent) => {
      if (!isField(event.target)) return;
      window.clearTimeout(closeTimer);
      setOpen(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (isField(event.relatedTarget)) return;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => setOpen(false), 300);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.clearTimeout(closeTimer);
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
    case "settings":
      return <SettingsIcon size={22} />;
  }
}

function SettingsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
