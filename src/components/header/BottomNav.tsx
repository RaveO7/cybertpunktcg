"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { NavBadge } from "./NavBadge";
import { NavGlyph } from "./NavGlyph";
import { useKeyboardOpen } from "./use-keyboard-open";
import { usePageSwipe } from "./use-page-swipe";
import { useNavigation } from "./use-navigation";

/** Barre d'onglets façon application, affichée uniquement sur téléphone. */
export function BottomNav() {
  const { pathname, t, showNav, links, activeMatch, markPending } = useNavigation();
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
      // Reste utilisable sous une fenêtre ouverte : changer de section la ferme sans passer par la croix.
      data-modal-keep=""
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
                <span className="max-w-full truncate text-[12px] leading-none">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
