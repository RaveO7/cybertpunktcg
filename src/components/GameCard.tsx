"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useExampleNote } from "@/lib/rules/use-rules";
import type { ExampleCard } from "@/lib/rules/examples";
import { CardImage } from "@/components/CardImage";
import { LIFT_SCALE, liftRect, placeZoom, zoomSize, type Rect } from "@/components/card-lift";

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
  coachId?: string;
}) {
  const exampleNote = useExampleNote();
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

  // Carte « soulevée » (survol souris ou appui long) : copie agrandie dans un calque au-dessus du plateau,
  // que les conteneurs du plateau (overflow: hidden) ne peuvent pas rogner.
  const [hover, setHover] = useState(false);
  // Fin du survol : la carte soulevée redescend vers sa place avant de disparaître.
  const [leaving, setLeaving] = useState(false);
  // Carte retournée (Legend appelée…) : on rejoue l'animation de flip.
  const [shownFaceDown, setShownFaceDown] = useState(faceDown);
  const [flips, setFlips] = useState(0);
  if (shownFaceDown !== faceDown) {
    setShownFaceDown(faceDown);
    setFlips((n) => n + 1);
  }
  const [layout, setLayout] = useState<{ lift: Rect; zoom: Rect; angle: number } | null>(null);
  const ref = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const tipId = useId();

  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const updatePos = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const lift = liftRect(el.getBoundingClientRect(), el.offsetWidth, viewport);
    // Hauteur réelle une fois la fiche affichée : un texte long (allemand…) dépasse l'estimation.
    const size = zoomSize(viewport, tipRef.current?.offsetHeight ?? 0);
    const { x, y } = placeZoom(lift, size, viewport);
    const zoom = { left: x, top: y, ...size };
    const angle = visualAngle(el);
    setLayout((prev) =>
      prev && sameRect(prev.lift, lift) && sameRect(prev.zoom, zoom) && Math.abs(prev.angle - angle) < 0.1
        ? prev
        : { lift, zoom, angle },
    );
  }, []);

  const startLift = useCallback(() => {
    setLeaving(false);
    setHover(true);
  }, []);

  // `immediate` : la carte part ailleurs (clic) ou les animations sont réduites, pas de retour animé.
  const endLift = useCallback((immediate = false) => {
    setHover(false);
    if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLeaving(false);
      setLayout(null);
    } else {
      setLeaving(true);
    }
  }, []);

  const clearPress = useCallback(() => {
    if (pressTimer.current != null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }, []);

  useEffect(() => clearPress, [clearPress]);

  // Avant peinture, à chaque rendu tant que la carte est soulevée : la fiche vient d'être montée
  // (ou élargie), on la replace selon sa vraie hauteur. S'arrête dès que rien ne change.
  useLayoutEffect(() => {
    if (hover) updatePos();
  });

  useEffect(() => {
    if (!hover) return;
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [hover, updatePos]);

  const note = exampleNote(card);
  const clickable = Boolean(onClick);
  const lifted = (hover || leaving) && !faceDown;

  // Visuel de la carte, rendu à l'identique en place et dans le calque soulevé.
  const visual = (inPlace: boolean) => (
    <>
      <div
        key={flips}
        className={[
          "relative overflow-hidden border bg-black shadow-lg transition",
          inPlace && flips > 0 ? "dm-flip-in" : "",
          pulse
            ? "border-yellow shadow-[0_0_18px_rgba(245,230,66,0.55)]"
            : selected
              ? "border-cyan shadow-[0_0_14px_rgba(62,224,255,0.45)]"
              : inPlace
                ? "border-line group-hover:border-cyan/70"
                : "border-cyan/70",
          spent ? "grayscale-[0.35]" : "",
        ].join(" ")}
      >
        {faceDown ? (
          <div className="aspect-card bg-[linear-gradient(145deg,#243049_0%,#0a0c16_55%,#152033_100%)] flex items-center justify-center">
            <span className="font-mono text-[0.65rem] tracking-[0.16em] text-cyan/80">€$</span>
          </div>
        ) : (
          <CardImage
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
        <div data-equipped={inPlace ? "" : undefined} className="pointer-events-none absolute -right-2 -top-3 w-[55%] rotate-12">
          <CardImage
            src={equipped.imagePath}
            alt=""
            className="aspect-card w-full border border-cyan/50 object-cover shadow-md"
            draggable={false}
          />
        </div>
      ) : null}
    </>
  );

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
          if (onClick) {
            endLift(true);
            onClick();
          }
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && !faceDown) startLift();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") endLift();
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" || faceDown) return;
          longPressed.current = false;
          clearPress();
          pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            startLift();
          }, 400);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          clearPress();
          endLift();
        }}
        onPointerCancel={() => {
          clearPress();
          endLift();
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
        ].join(" ")}
        aria-describedby={hover && !faceDown ? tipId : undefined}
        aria-label={card.name}
      >
        {/* Invisible pendant le soulèvement : le bouton garde sa place, le pointeur et le clic. */}
        <div className="relative" data-lifted={lifted ? "" : undefined}>
          {visual(true)}
        </div>
      </button>

      {lifted && typeof document !== "undefined"
        ? createPortal(
            <>
              {layout ? (
                <div
                  className={`dm-lift pointer-events-none fixed z-[65] ${leaving ? "dm-lift--out" : ""}`}
                  style={
                    {
                      left: layout.lift.left,
                      top: layout.lift.top,
                      width: layout.lift.width,
                      // Part de l'inclinaison et de la taille de la carte en place, puis se redresse.
                      "--dm-lift-rotate": `${layout.angle}deg`,
                      "--dm-lift-scale": 1 / LIFT_SCALE,
                    } as CSSProperties
                  }
                  onAnimationEnd={(e) => {
                    if (e.target !== e.currentTarget || !leaving) return;
                    setLeaving(false);
                    setLayout(null);
                  }}
                  aria-hidden
                >
                  <div className={`relative ${dimmed ? "opacity-45" : spent ? "opacity-70" : ""}`}>{visual(false)}</div>
                </div>
              ) : null}
              {hover ? (
              <div
                ref={tipRef}
                id={tipId}
                role="tooltip"
                className="pointer-events-none fixed z-[80]"
                style={{
                  left: layout?.zoom.left ?? 0,
                  top: layout?.zoom.top ?? 0,
                  width: layout?.zoom.width ?? 200,
                  // Mesurée avant d'être placée : invisible jusque-là.
                  visibility: layout ? undefined : "hidden",
                }}
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
              </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function sameRect(a: Rect, b: Rect) {
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** Inclinaison visible de la carte : sa rotation et celle de ses parents (éventail de la main, carte couchée). */
function visualAngle(el: HTMLElement) {
  let angle = 0;
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    const rotate = parseFloat(style.rotate);
    if (Number.isFinite(rotate)) angle += rotate;
    if (style.transform && style.transform !== "none") {
      const m = new DOMMatrix(style.transform);
      angle += (Math.atan2(m.b, m.a) * 180) / Math.PI;
    }
  }
  return angle;
}
