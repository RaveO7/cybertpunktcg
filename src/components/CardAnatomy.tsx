"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ANATOMY_CARDS,
  anatomyCopy,
  type AnatomyCard,
  type AnatomyPartId,
  type AnatomyPoint,
} from "@/lib/rules/card-anatomy";
import { EXAMPLE_CARDS } from "@/lib/rules/examples";

type Line = { part: AnatomyPartId; d: string };

export function CardAnatomy({ locale }: { locale: "fr" | "en" }) {
  const copy = anatomyCopy(locale);
  const [cardId, setCardId] = useState<AnatomyCard["id"]>("unit");
  const [selected, setSelected] = useState<AnatomyPartId>("cost");
  const [hovered, setHovered] = useState<AnatomyPartId | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const calloutRefs = useRef<Partial<Record<AnatomyPartId, HTMLButtonElement | null>>>({});
  const pointsRef = useRef(ANATOMY_CARDS[0].points);

  const anatomy = ANATOMY_CARDS.find((card) => card.id === cardId) ?? ANATOMY_CARDS[0];
  const card = EXAMPLE_CARDS[anatomy.exampleKey];
  const active = hovered ?? selected;
  const leftPoints = anatomy.points.filter((p) => p.side === "left");
  const rightPoints = anatomy.points.filter((p) => p.side === "right");

  function measureLines() {
    const root = rootRef.current;
    const cardEl = cardRef.current;
    if (!root || !cardEl) return;

    const rootBox = root.getBoundingClientRect();
    const cardBox = cardEl.getBoundingClientRect();
    const next: Line[] = [];

    for (const point of pointsRef.current) {
      const callout = calloutRefs.current[point.part];
      if (!callout) continue;

      const calloutBox = callout.getBoundingClientRect();
      const startX = ((cardBox.left - rootBox.left + (cardBox.width * point.x) / 100) / rootBox.width) * 100;
      const startY = ((cardBox.top - rootBox.top + (cardBox.height * point.y) / 100) / rootBox.height) * 100;
      const endX =
        ((calloutBox.left - rootBox.left + (point.side === "left" ? calloutBox.width : 0)) / rootBox.width) * 100;
      const endY = ((calloutBox.top - rootBox.top + calloutBox.height / 2) / rootBox.height) * 100;
      const midX = point.side === "left" ? (startX + endX) / 2 - 1.5 : (startX + endX) / 2 + 1.5;

      next.push({
        part: point.part,
        d: `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`,
      });
    }

    setLines(next);
  }

  useLayoutEffect(() => {
    const points = ANATOMY_CARDS.find((c) => c.id === cardId)?.points ?? ANATOMY_CARDS[0].points;
    pointsRef.current = points;
    measureLines();
  }, [cardId, locale]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureLines());
    observer.observe(root);
    window.addEventListener("resize", measureLines);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureLines);
    };
  }, []);

  function bodyFor(part: AnatomyPartId) {
    if (cardId === "legend") return copy.legendOverrides[part] ?? copy.parts[part].body;
    return copy.parts[part].body;
  }

  function switchCard(id: AnatomyCard["id"]) {
    setCardId(id);
    const next = ANATOMY_CARDS.find((c) => c.id === id);
    if (next && !next.points.some((p) => p.part === selected)) setSelected(next.points[0].part);
  }

  function Callout({ point }: { point: AnatomyPoint }) {
    const isActive = active === point.part;
    const align = point.side === "left" ? "text-right items-end" : "text-left items-start";

    return (
      <button
        type="button"
        ref={(el) => {
          calloutRefs.current[point.part] = el;
        }}
        onClick={() => setSelected(point.part)}
        onMouseEnter={() => setHovered(point.part)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(point.part)}
        onBlur={() => setHovered(null)}
        aria-pressed={selected === point.part}
        className={`flex w-full flex-col gap-1 border px-3 py-2.5 transition ${align} ${
          isActive
            ? "border-yellow/80 bg-yellow/10 shadow-[0_0_18px_rgba(245,230,66,0.18)]"
            : "border-transparent hover:border-yellow/30 hover:bg-white/[0.02]"
        }`}
      >
        <span
          className={`font-mono text-[0.7rem] font-bold tracking-[0.14em] uppercase ${
            isActive ? "text-yellow" : "text-yellow/80"
          }`}
        >
          {copy.parts[point.part].name}
        </span>
        <span className={`text-xs leading-relaxed ${isActive ? "text-foreground" : "text-muted"}`}>
          {bodyFor(point.part)}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">{copy.intro}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{copy.hint}</span>
        {ANATOMY_CARDS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => switchCard(entry.id)}
            className={`border px-3 py-1 text-xs ${
              cardId === entry.id ? "border-yellow bg-yellow text-black" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {copy.cards[entry.id].tab}
          </button>
        ))}
      </div>

      {/* Desktop / tablet: official-style diagram with leader lines */}
      <div
        ref={rootRef}
        className="relative hidden overflow-hidden border border-line bg-[#05060a] p-4 md:block lg:p-6"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 45%, rgba(245,230,66,0.08), transparent 42%), repeating-linear-gradient(0deg, transparent 0 11px, rgba(255,255,255,0.025) 11px 12px)",
          }}
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(11rem,18rem)_minmax(0,1fr)] items-center gap-3 lg:gap-5">
          <div className="relative z-[3] flex flex-col justify-center gap-1">
            {leftPoints.map((point) => (
              <Callout key={point.part} point={point} />
            ))}
          </div>

          <figure className="relative mx-auto w-full max-w-[18rem]">
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-[4.5%/3.2%] border border-yellow/50 bg-black shadow-[0_0_40px_rgba(245,230,66,0.12)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.imagePath} alt={card.name} className="aspect-card w-full object-cover" draggable={false} />
              {anatomy.points.map((point) => {
                const isActive = active === point.part;
                return (
                  <button
                    key={point.part}
                    type="button"
                    onClick={() => setSelected(point.part)}
                    onMouseEnter={() => setHovered(point.part)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={copy.parts[point.part].name}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    className={`absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
                      isActive
                        ? "scale-125 border-black bg-yellow shadow-[0_0_0_3px_rgba(245,230,66,0.45)]"
                        : "border-yellow/90 bg-yellow/80 hover:scale-110"
                    }`}
                  />
                );
              })}
            </div>
            <figcaption className="mt-2 text-center text-xs text-muted">{copy.cards[cardId].caption}</figcaption>
          </figure>

          <div className="relative z-[3] flex flex-col justify-center gap-1">
            {rightPoints.map((point) => (
              <Callout key={point.part} point={point} />
            ))}
          </div>
        </div>

        <svg
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {lines.map((line) => {
            const isActive = active === line.part;
            return (
              <path
                key={line.part}
                d={line.d}
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke={isActive ? "#f5e642" : "rgba(245,230,66,0.35)"}
                strokeWidth={isActive ? 1.6 : 1}
                className="transition-[stroke,stroke-width] duration-150"
              />
            );
          })}
        </svg>
      </div>

      {/* Mobile: stacked list (leader lines don't fit) */}
      <div className="space-y-4 border border-line bg-[#05060a] p-4 md:hidden">
        <figure className="mx-auto w-full max-w-[16rem]">
          <div className="relative overflow-hidden rounded-[4.5%/3.2%] border border-yellow/50 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.imagePath} alt={card.name} className="aspect-card w-full object-cover" draggable={false} />
            {anatomy.points.map((point) => {
              const isActive = active === point.part;
              return (
                <button
                  key={point.part}
                  type="button"
                  onClick={() => setSelected(point.part)}
                  aria-label={copy.parts[point.part].name}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  className={`absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                    isActive ? "border-black bg-yellow" : "border-yellow bg-yellow/80"
                  }`}
                />
              );
            })}
          </div>
        </figure>
        <div className="border border-yellow/50 bg-yellow/5 p-3" aria-live="polite">
          <p className="font-mono text-xs font-bold tracking-[0.14em] text-yellow uppercase">
            {copy.parts[active].name}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{bodyFor(active)}</p>
        </div>
        <ol className="grid gap-1.5">
          {anatomy.points.map((point) => (
            <li key={point.part}>
              <button
                type="button"
                onClick={() => setSelected(point.part)}
                className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left text-sm ${
                  active === point.part
                    ? "border-yellow bg-yellow/10 text-foreground"
                    : "border-line text-muted"
                }`}
              >
                <span className="size-2 shrink-0 rounded-full bg-yellow" />
                {copy.parts[point.part].name}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
