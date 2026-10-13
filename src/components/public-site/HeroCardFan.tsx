"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

export type FanCard = { slug: string; name: string; href: string; thumb: string; alt: string };

/** Inclinaison maximale (degrés) d'une carte sous le pointeur. */
const MAX_TILT = 14;

/**
 * Éventail de Légendes de l'accueil. Les cartes s'ouvrent une fois au chargement ; survol ou focus
 * soulève une carte et écarte ses voisines ; sous la souris elle s'incline avec un reflet holographique.
 * Mouvement réduit : éventail ouvert d'emblée, sans inclinaison (cf. .hero-fan dans globals.css).
 */
export function HeroCardFan({ cards, label }: { cards: FanCard[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Laisse le premier rendu (cartes empilées) s'afficher, puis ouvre l'éventail.
    const id = window.setTimeout(() => setOpen(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  function onPointerMove(event: PointerEvent<HTMLAnchorElement>, index: number) {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setActive(index);
      setTilt({ x: (0.5 - py) * MAX_TILT * 2, y: (px - 0.5) * MAX_TILT * 2, glareX: px * 100, glareY: py * 100 });
    });
  }

  function release() {
    setActive(null);
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
  }

  const middle = (cards.length - 1) / 2;

  return (
    <ul className="hero-fan relative mx-auto aspect-[4/3] w-full max-w-[34rem]" aria-label={label} data-open={open || undefined}>
      {cards.map((card, index) => {
        const offset = index - middle;
        const isActive = active === index;
        // Les voisines de la carte active s'écartent ; les autres restent à leur place dans l'éventail.
        const push = active === null || isActive ? 0 : Math.sign(index - active) * (Math.abs(index - active) === 1 ? 30 : 16);
        const spread = open ? offset * 32 + push : 0;
        const rotate = open && !isActive ? offset * 6 : 0;
        const lift = open ? Math.abs(offset) * 3.5 - (isActive ? 9 : 0) : 0;
        const style = {
          "--fan-x": `${spread}%`,
          "--fan-y": `${lift}%`,
          "--fan-r": `${rotate}deg`,
          "--fan-s": isActive ? 1.08 : 1,
          "--tilt-x": isActive ? `${tilt.x}deg` : "0deg",
          "--tilt-y": isActive ? `${tilt.y}deg` : "0deg",
          "--glare-x": `${isActive ? tilt.glareX : 50}%`,
          "--glare-y": `${isActive ? tilt.glareY : 50}%`,
          zIndex: isActive ? 20 : 10 - Math.round(Math.abs(offset) * 2),
          transitionDelay: open && active === null ? `${Math.abs(offset) * 60}ms` : "0ms",
        } as CSSProperties;
        return (
          <li key={card.slug} className="hero-fan-card" style={style} data-active={isActive || undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la carte */}
            <img src={card.thumb} alt="" aria-hidden="true" className="hero-fan-glow" />
            <Link
              href={card.href}
              className="hero-fan-face"
              onPointerMove={(event) => onPointerMove(event, index)}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={release}
              onFocus={() => setActive(index)}
              onBlur={release}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatures pré-générées */}
              <img src={card.thumb} alt={card.alt} width={400} height={559} loading="eager" decoding="async" draggable={false} />
              <span className="hero-fan-glare" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
