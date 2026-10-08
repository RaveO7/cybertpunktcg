"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/LocaleProvider";
import type { ExampleCard } from "@/lib/rules/examples";
import { CardImage } from "@/components/CardImage";

export function RulesExampleCard({
  card,
  note,
  size = "md",
  faceDown = false,
  spent = false,
  label,
}: {
  card: ExampleCard;
  note?: string;
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
  spent?: boolean;
  label?: string;
}) {
  const { locale } = useI18n();
  const width = size === "lg" ? "w-[7.5rem] sm:w-36" : size === "sm" ? "w-14 sm:w-16" : "w-[5.5rem] sm:w-24";

  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoomW, setZoomW] = useState(200);
  const ref = useRef<HTMLDivElement | null>(null);
  const tipId = useId();

  const updatePos = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(240, Math.max(176, window.innerWidth * 0.14));
    const h = w * 1.4;
    let x = r.left + r.width / 2 - w / 2;
    let y = r.top - h - 12;
    if (y < 8) y = r.bottom + 12;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    setZoomW(w);
    setPos({ x, y });
  }, []);

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

  const face = faceDown ? (
    <div className="aspect-card flex items-center justify-center bg-[linear-gradient(145deg,#1a2233_0%,#0a0c16_55%,#12182a_100%)]">
      <span className="font-mono text-[0.55rem] tracking-[0.14em] text-cyan/70 sm:text-[0.65rem]">€$</span>
    </div>
  ) : (
    <CardImage
      src={card.imagePath}
      alt={card.name}
      className="aspect-card w-full object-cover"
      loading="lazy"
      draggable={false}
    />
  );

  const zoomNote = locale === "fr" ? card.noteFr : card.noteEn;

  return (
    <figure className={`flex flex-col gap-1.5 ${width}`}>
      <div
        ref={ref}
        onMouseEnter={() => {
          if (!faceDown) {
            setHover(true);
            updatePos();
          }
        }}
        onMouseLeave={() => setHover(false)}
        className={`relative transition-transform duration-200 ${hover ? "z-20 scale-110" : ""}`}
        aria-describedby={hover ? tipId : undefined}
      >
        <div
          className={`relative block overflow-hidden border bg-black transition ${hover ? "border-cyan/70" : "border-line"} ${spent ? "origin-center rotate-90" : ""}`}
          title={card.name}
        >
          {face}
          {label ? (
            <span className="absolute bottom-0 left-0 right-0 bg-black/75 px-1 py-0.5 text-center font-mono text-[0.55rem] uppercase tracking-wider text-yellow">
              {label}
            </span>
          ) : null}
        </div>
      </div>
      {note ? (
        <figcaption className="text-center font-mono text-[0.65rem] leading-tight tracking-wide text-muted">
          {note}
        </figcaption>
      ) : null}

      {hover && !faceDown && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[80]"
              style={{ left: pos.x, top: pos.y, width: zoomW }}
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
                  <p className="text-[0.7rem] leading-snug text-muted">{zoomNote}</p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </figure>
  );
}
