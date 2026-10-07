"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ExampleCard } from "@/lib/rules/examples";

export function GameCard({
  card,
  size = "md",
  faceDown = false,
  spent = false,
  selected = false,
  pulse = false,
  dimmed = false,
  equipped,
  onClick,
  locale = "fr",
  coachId,
}: {
  card: ExampleCard;
  size?: "xs" | "sm" | "md" | "lg" | "fluid-xs" | "fluid-sm" | "fluid-md" | "fluid-lg" | "fluid-hand" | "fluid-rival" | "fluid-pile";
  faceDown?: boolean;
  spent?: boolean;
  selected?: boolean;
  pulse?: boolean;
  dimmed?: boolean;
  equipped?: ExampleCard | null;
  onClick?: () => void;
  locale?: "fr" | "en";
  coachId?: string;
}) {
  const width =
    size === "fluid-hand"
      ? "w-[var(--dm-card-hand)]"
      : size === "fluid-rival"
        ? "w-[var(--dm-card-rival)]"
        : size === "fluid-pile"
          ? "w-[var(--dm-pile)]"
          : size === "fluid-lg"
            ? "w-[var(--dm-card-lg)]"
            : size === "fluid-md"
              ? "w-[var(--dm-card-md)]"
              : size === "fluid-sm"
                ? "w-[var(--dm-card-sm)]"
                : size === "fluid-xs"
                  ? "w-[var(--dm-card-xs)]"
            : size === "lg"
              ? "w-24 sm:w-28"
              : size === "md"
                ? "w-[4.75rem] sm:w-24"
                : size === "sm"
                  ? "w-14 sm:w-16"
                  : "w-11 sm:w-12";

  const [hover, setHover] = useState(false);
  // Carte retournée (Legend appelée…) : on rejoue l'animation de flip.
  const [shownFaceDown, setShownFaceDown] = useState(faceDown);
  const [flips, setFlips] = useState(0);
  if (shownFaceDown !== faceDown) {
    setShownFaceDown(faceDown);
    setFlips((n) => n + 1);
  }
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoomSize, setZoomSize] = useState({ w: 200, h: 280 });
  const ref = useRef<HTMLButtonElement | null>(null);
  const tipId = useId();

  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const updatePos = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // ~96 px de texte sous l'image : le zoom doit tenir dans l'écran (téléphone en paysage).
    const info = 96;
    const zoomW = Math.max(110, Math.min(240, Math.max(176, vw * 0.14), (vh - 16 - info) / 1.4));
    const zoomH = zoomW * 1.4 + info;
    let x = r.left + r.width / 2 - zoomW / 2;
    let y = r.top - zoomH - 12;
    if (y < 8) {
      y = r.bottom + 12;
      if (y + zoomH > vh - 8) {
        // Ni au-dessus ni en dessous : à côté de la carte.
        y = Math.max(8, Math.min(r.top + r.height / 2 - zoomH / 2, vh - zoomH - 8));
        x = r.right + 12 + zoomW <= vw - 8 ? r.right + 12 : r.left - zoomW - 12;
      }
    }
    x = Math.max(8, Math.min(x, vw - zoomW - 8));
    setZoomSize({ w: zoomW, h: zoomH });
    setPos({ x, y });
  }, []);

  const clearPress = useCallback(() => {
    if (pressTimer.current != null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }, []);

  useEffect(() => clearPress, [clearPress]);

  useEffect(() => {
    if (!hover) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [hover, updatePos]);

  const note = locale === "fr" ? card.noteFr : card.noteEn;
  const clickable = Boolean(onClick);

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-coach-id={coachId}
        disabled={false}
        onClick={() => {
          // Un appui long sert à lire la carte : il ne déclenche pas l'action.
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onClick?.();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && !faceDown) {
            setHover(true);
            updatePos();
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHover(false);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" || faceDown) return;
          longPressed.current = false;
          clearPress();
          pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            updatePos();
            setHover(true);
          }, 400);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          clearPress();
          setHover(false);
        }}
        onPointerCancel={() => {
          clearPress();
          setHover(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={[
          "group no-touch-callout relative shrink-0 text-left transition-transform duration-200",
          width,
          clickable || pulse ? "cursor-pointer" : "cursor-default",
          pulse ? "dm-target z-10 scale-105" : "",
          // Dépensée = carte « couchée », comme sur une vraie table.
          spent && !pulse ? "rotate-6" : "",
          selected ? "scale-110" : "",
          dimmed ? "opacity-45" : "",
          spent ? "opacity-70" : "",
          hover && !faceDown ? "z-20 scale-110" : "",
        ].join(" ")}
        aria-describedby={hover ? tipId : undefined}
        aria-label={card.name}
      >
        <div
          key={flips}
          className={[
            "relative overflow-hidden border bg-black shadow-lg transition",
            flips > 0 ? "dm-flip-in" : "",
            pulse
              ? "border-yellow shadow-[0_0_18px_rgba(245,230,66,0.55)]"
              : selected
                ? "border-cyan shadow-[0_0_14px_rgba(62,224,255,0.45)]"
                : "border-line group-hover:border-cyan/70",
            spent ? "grayscale-[0.35]" : "",
          ].join(" ")}
        >
          {faceDown ? (
            <div className="aspect-card bg-[linear-gradient(145deg,#243049_0%,#0a0c16_55%,#152033_100%)] flex items-center justify-center">
              <span className="font-mono text-[0.65rem] tracking-[0.16em] text-cyan/80">€$</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imagePath}
              alt=""
              className="aspect-card w-full object-cover"
              draggable={false}
              loading="lazy"
            />
          )}
          {spent && !faceDown ? (
            <span className="absolute bottom-0 inset-x-0 bg-black/75 py-0.5 text-center font-mono text-[0.55rem] uppercase tracking-wider text-muted">
              spent
            </span>
          ) : null}
          {pulse ? (
            <>
              <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-yellow/80" />
              <span className="dm-shine" aria-hidden />
            </>
          ) : null}
        </div>
        {equipped ? (
          <div className="pointer-events-none absolute -right-2 -top-3 w-[55%] rotate-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={equipped.imagePath}
              alt=""
              className="aspect-card w-full border border-cyan/50 object-cover shadow-md"
              draggable={false}
            />
          </div>
        ) : null}
      </button>

      {hover && !faceDown && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[80]"
              style={{ left: pos.x, top: pos.y, width: zoomSize.w, maxHeight: zoomSize.h }}
            >
              <div className="overflow-hidden border border-cyan/50 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.imagePath} alt={card.name} className="aspect-card w-full object-cover" />
                <div className="space-y-1 border-t border-line bg-panel p-2">
                  <p className="text-xs font-medium leading-snug text-yellow">{card.name}</p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-wider text-cyan">
                    {card.type}
                    {card.cost != null ? ` · ${card.cost}€$` : ""}
                    {card.power != null ? ` · P${card.power}` : ""}
                  </p>
                  <p className="text-[0.7rem] leading-snug text-muted">{note}</p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
