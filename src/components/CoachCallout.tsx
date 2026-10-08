"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right";

function pickPlacement(rect: DOMRect): Placement {
  if (rect.top > 130) return "top";
  if (window.innerHeight - rect.bottom > 100) return "bottom";
  if (rect.left > window.innerWidth / 2) return "left";
  return "right";
}

export function CoachCallout({
  anchorId,
  title,
  body,
  stepLabel,
  ringOnly = false,
}: {
  anchorId: string;
  title?: string;
  body?: string;
  stepLabel?: string;
  /** Surligne seulement la cible (le texte est affiché ailleurs, ex. panneau mobile). */
  ringOnly?: boolean;
}) {
  const [box, setBox] = useState<{
    left: number;
    top: number;
    placement: Placement;
    target: { left: number; top: number; width: number; height: number };
  } | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-coach-id="${anchorId}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const placement = pickPlacement(r);
    const popupW = Math.min(248, window.innerWidth - 16);
    const popupH = 88;
    let left = r.left + r.width / 2 - popupW / 2;
    let top = r.top - popupH - 8;

    if (placement === "bottom") {
      top = r.bottom + 8;
    } else if (placement === "left") {
      left = r.left - popupW - 10;
      top = r.top + r.height / 2 - popupH / 2;
    } else if (placement === "right") {
      left = r.right + 10;
      top = r.top + r.height / 2 - popupH / 2;
    }

    left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - popupH - 8));

    setBox({
      left,
      top,
      placement,
      target: { left: r.left, top: r.top, width: r.width, height: r.height },
    });
  }, [anchorId]);

  useLayoutEffect(() => {
    // Mesure du DOM avant affichage : c'est le rôle de useLayoutEffect (la bulle ne clignote pas).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
  }, [measure, title, body]);

  useEffect(() => {
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const id = window.setInterval(measure, 350);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      window.clearInterval(id);
    };
  }, [measure]);

  if (!box || typeof document === "undefined") return null;

  const cx = box.target.left + box.target.width / 2;
  const cy = box.target.top + box.target.height / 2;
  const arrow =
    box.placement === "top"
      ? { left: cx - 6, top: box.top + 84, rotate: "180deg" }
      : box.placement === "bottom"
        ? { left: cx - 6, top: box.top - 6, rotate: "0deg" }
        : box.placement === "left"
          ? { left: box.left + Math.min(248, window.innerWidth - 16) - 4, top: cy - 6, rotate: "90deg" }
          : { left: box.left - 6, top: cy - 6, rotate: "-90deg" };

  return createPortal(
    <>
      <div
        className="dm-ring pointer-events-none fixed z-[70] rounded-sm ring-2 ring-yellow ring-offset-1 ring-offset-black/80"
        style={{
          left: box.target.left - 2,
          top: box.target.top - 2,
          width: box.target.width + 4,
          height: box.target.height + 4,
          boxShadow: "0 0 0 1px rgba(245,230,66,0.35)",
        }}
      />
      {ringOnly ? null : (
        <>
      <div
        className="pointer-events-none fixed z-[72] size-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-yellow"
        style={{
          left: arrow.left,
          top: arrow.top,
          transform: `rotate(${arrow.rotate})`,
        }}
      />
      <div
        className="dm-coach-in pointer-events-none fixed z-[73] w-[min(248px,calc(100vw-16px))] border border-yellow/80 bg-[#0d1118]/95 p-2 shadow-lg backdrop-blur-sm"
        style={{ left: box.left, top: box.top }}
        role="status"
      >
        <p className="font-mono text-[0.6rem] tracking-[0.12em] text-yellow uppercase">{stepLabel}</p>
        <p className="mt-0.5 text-xs font-medium leading-snug text-foreground">{title}</p>
        <p className="mt-1 line-clamp-3 text-[0.68rem] leading-snug text-muted">{body}</p>
      </div>
        </>
      )}
    </>,
    document.body,
  );
}
