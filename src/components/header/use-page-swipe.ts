"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { isInHorizontalScroller } from "@/lib/swipe";
import type { NavLink } from "./use-navigation";

/**
 * Téléphone : balayer l'écran vers la gauche/droite passe à l'onglet suivant/précédent de la barre du bas.
 * Ignoré dans les champs, les fenêtres modales, les zones défilant horizontalement ou ayant leurs
 * propres balayages (`data-swipe-zone`), et près des bords (geste « retour » du système).
 * `data-swipe-zone="next"` (ou `"prev"`) ne réserve à la zone que ce sens : l'autre change encore de page.
 */
export function usePageSwipe(links: NavLink[], pathname: string, enabled: boolean) {
  const router = useRouter();
  const index = links.findIndex((link) => link.match === pathname);
  const prevHref = index > 0 ? links[index - 1].href : null;
  const nextHref = index >= 0 && index < links.length - 1 ? links[index + 1].href : null;

  useEffect(() => {
    if (!enabled || (!prevHref && !nextHref)) return;
    const phone = window.matchMedia("(max-width: 639px)");
    let start: { x: number; y: number; time: number; reserved: string | null } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1 || !phone.matches) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (document.querySelector("[aria-modal=true]") || isInHorizontalScroller(target)) return;
      const reserved = target.closest("[data-swipe-zone]")?.getAttribute("data-swipe-zone") ?? null;
      if (reserved === "") return;
      const touch = event.touches[0];
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp, reserved };
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
      const direction = dx < 0 ? "next" : "prev";
      if (origin.reserved === direction) return;
      const href = direction === "next" ? nextHref : prevHref;
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
