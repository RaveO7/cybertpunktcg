"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";

export function Header() {
  const pathname = usePathname();
  const { cardsHref } = useBrowseSelection();
  const { user, ready } = useCollection();
  const { t } = useI18n();
  const sharedMatch = pathname.match(/^\/classeur\/([^/]+)/);
  const isSharedView = Boolean(sharedMatch);
  const shareToken = sharedMatch?.[1] ?? null;
  const showNav = isSharedView || (ready && Boolean(user));

  const links = isSharedView && shareToken
    ? [
        { href: `/classeur/${shareToken}`, label: t.share.binderNav, match: `/classeur/${shareToken}` },
        {
          href: `/classeur/${shareToken}/cartes`,
          label: t.nav.cards,
          match: `/classeur/${shareToken}/cartes`,
        },
      ]
    : [
        { href: "/", label: t.nav.dashboard, match: "/" },
        { href: cardsHref, label: t.nav.cards, match: "/cards" },
        { href: "/investissement", label: t.nav.investment, match: "/investissement" },
        { href: "/comment-jouer", label: t.nav.howto, match: "/comment-jouer" },
      ];

  const actionClass =
    "inline-flex size-10 shrink-0 items-center justify-center border border-line text-muted hover:border-cyan hover:text-foreground";

  return (
    <header className="relative z-30 shrink-0 border-b border-line bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <Link href={isSharedView && shareToken ? `/classeur/${shareToken}` : "/"} className="shrink-0 text-sm text-yellow">
          TCG Tracker
        </Link>
        {user && !isSharedView ? (
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:order-3 sm:ml-0">
            <Link
              href="/parametres"
              className={`${actionClass} ${pathname === "/parametres" ? "border-yellow bg-yellow text-black hover:border-yellow hover:text-black" : ""}`}
              aria-label={t.common.settings}
              title={t.common.settings}
              aria-current={pathname === "/parametres" ? "page" : undefined}
            >
              <SettingsIcon />
            </Link>
          </div>
        ) : null}
        {showNav ? (
          <nav
            className="order-3 flex w-full border border-line sm:order-2 sm:ml-auto sm:w-auto"
            aria-label={t.common.sections}
          >
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
      </div>
    </header>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  );
}
