"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { TrackCardLink } from "@/components/public-site/TrackCardLink";
import { useModal } from "@/components/use-modal";

export type FanCard = {
  slug: string;
  name: string;
  href: string;
  thumb: string;
  alt: string;
  /** « Légende · Rouge » */
  kind: string;
  color: string | null;
  cost: number | null;
  power: number | null;
  ram: number | null;
  rules: string | null;
  price: string | null;
  printingId: string | null;
};

export type FanLabels = {
  list: string;
  close: string;
  track: string;
  price: string;
};

/** Inclinaison maximale (degrés) d'une carte sous le pointeur. */
const MAX_TILT = 14;
/** Distribution des cartes à l'arrivée : écart entre deux cartes, et durée d'un vol. */
const DEAL_STEP_MS = 120;
const DEAL_MS = 900;
/** Image du dos des cartes du jeu, montrée pendant le tour de la carte agrandie. */
const CARD_BACK = "/card-images/card-back.webp";
/** Filet si la fin de transition n'arrive pas (onglet masqué…) ; durée réelle : .card-dialog-* dans globals.css. */
const CLOSE_FALLBACK_MS = 900;

const ACCENTS: Record<string, string> = {
  Red: "var(--cp-card-red)",
  Blue: "var(--cp-card-blue)",
  Green: "var(--cp-card-green)",
  Yellow: "var(--cp-card-yellow)",
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Texte de règles : les mots-clés entre accolades ({Call}, {Go Solo}) en gras. */
function Rules({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, lineIndex) => (
        <p key={lineIndex} className="mt-1.5 first:mt-0">
          {line.split(/(\{[^}]+\})/).map((part, index) =>
            /^\{[^}]+\}$/.test(part) ? (
              <strong key={index} className="text-yellow">
                {part.slice(1, -1)}
              </strong>
            ) : (
              <Fragment key={index}>{part}</Fragment>
            ),
          )}
        </p>
      ))}
    </>
  );
}

/** Place d'une carte dans l'éventail : boîte (sans l'inclinaison 3D du survol) et rotation. */
type Spot = { rect: DOMRect; angle: number };
type Opened = { index: number; origin: Spot };

/**
 * Éventail de Légendes de l'accueil.
 * - Arrivée : les cartes sont distribuées une à une depuis le bas, comme une donne, et se posent en
 *   éventail ; un glitch marque la fin de la donne.
 * - Survol ou focus : la carte se soulève et écarte ses voisines ; sous la souris elle s'incline avec
 *   un reflet holographique.
 * - Clic : la carte grandit depuis l'éventail jusqu'au centre de l'écran, et sa fiche se déploie depuis
 *   son bord dans le même mouvement (aucun changement de page ; Ctrl/⌘-clic ou clic du milieu ouvrent
 *   toujours la page de la carte).
 * Mouvement réduit : éventail ouvert d'emblée, fiche affichée sans animation.
 */
export function HeroCardFan({ cards, labels }: { cards: FanCard[]; labels: FanLabels }) {
  const [phase, setPhase] = useState<"stacked" | "dealing" | "open">("stacked");
  const [active, setActive] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const [opened, setOpened] = useState<Opened | null>(null);
  const frame = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const faces = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (reducedMotion()) {
      const id = window.setTimeout(() => setPhase("open"), 0);
      return () => window.clearTimeout(id);
    }
    // Laisse le premier rendu (cartes hors champ) s'afficher, puis distribue.
    const start = window.setTimeout(() => setPhase("dealing"), 250);
    const end = window.setTimeout(
      () => {
        setPhase("open");
        // La donne se termine sur un glitch (cf. .cp-glitch-block.is-glitching).
        const list = listRef.current;
        list?.classList.add("is-glitching");
        window.setTimeout(() => list?.classList.remove("is-glitching"), 650);
      },
      250 + DEAL_MS + DEAL_STEP_MS * (cards.length - 1),
    );
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [cards.length]);

  useEffect(() => {
    // Précharge le dos de carte : il doit être prêt à mi-tour, dès la première ouverture.
    new Image().src = CARD_BACK;
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  function onPointerMove(event: PointerEvent<HTMLAnchorElement>, index: number) {
    // Mesuré sur la zone de survol : ni inclinée ni soulevée, elle ne bouge pas sous le pointeur.
    if (event.pointerType !== "mouse" || phase !== "open") return;
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
    // Une image en attente du dernier déplacement réactiverait la carte que l'on vient de quitter.
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setActive(null);
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
  }

  const middle = (cards.length - 1) / 2;
  const angleOf = (index: number) => (active === index ? 0 : (index - middle) * 6);

  function openCard(event: MouseEvent<HTMLAnchorElement>, index: number) {
    // Nouvel onglet demandé : on laisse le lien faire.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    // La boîte de l'élément de liste ignore l'inclinaison 3D du survol, portée par la face.
    const spot = faces.current[index]?.parentElement;
    if (!spot) return;
    setOpened({ index, origin: { rect: spot.getBoundingClientRect(), angle: angleOf(index) } });
    // L'éventail se remet au repos une fois la carte ouverte (il est caché derrière la fiche) : rien
    // d'autre ne bouge pendant l'agrandissement.
    window.setTimeout(release, 650);
  }

  // Place de retour à la fermeture : la carte n'est plus survolée, elle a repris sa rotation d'éventail.
  const originOf = useCallback((): Spot | null => {
    const spot = opened ? faces.current[opened.index]?.parentElement : null;
    if (!opened || !spot) return null;
    return { rect: spot.getBoundingClientRect(), angle: (opened.index - middle) * 6 };
  }, [opened, middle]);

  const closeCard = useCallback(() => {
    const index = opened?.index;
    setOpened(null);
    // Rend le focus à la carte, une fois qu'elle est de nouveau visible dans l'éventail.
    if (index !== undefined) requestAnimationFrame(() => faces.current[index]?.focus({ preventScroll: true }));
  }, [opened]);

  // Au repos, le centre est devant ; au survol, l'ordre suit la distance à la carte active, pour que
  // ses voisines passent devant les cartes plus éloignées au lieu de glisser dessous.
  const zIndexOf = (index: number) =>
    active === null ? 10 - Math.round(Math.abs(index - middle) * 2) : 20 - Math.abs(index - active) * 2;

  return (
    <>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[34rem]">
        <ul
          ref={listRef}
          className="hero-fan cp-glitch-block absolute inset-0"
          aria-label={labels.list}
          data-phase={phase}
          data-glitch="hero-fan"
        >
          {cards.map((card, index) => {
            const offset = index - middle;
            const isActive = active === index;
            const placed = phase !== "stacked";
            // Survol : la carte active se décale vers l'extérieur de l'éventail (une carte de bord ne
            // recouvre plus sa voisine) et ses voisines s'écartent d'elle.
            const distance = active === null ? 0 : Math.abs(index - active);
            const push = active === null ? 0 : isActive ? offset * 5 : Math.sign(index - active) * (distance === 1 ? 22 : 10);
            const style = {
              // Avant la donne : sous l'éventail, tournées, réduites et invisibles.
              "--fan-x": placed ? `${offset * 32 + push}%` : `${offset * 8}%`,
              "--fan-y": placed ? `${Math.abs(offset) * 3.5 - (isActive ? 9 : 0)}%` : "130%",
              "--fan-r": placed ? `${angleOf(index)}deg` : `${offset * -18 - 24}deg`,
              "--fan-s": placed ? (isActive ? 1.08 : 1) : 0.7,
              "--tilt-x": isActive ? `${tilt.x}deg` : "0deg",
              "--tilt-y": isActive ? `${tilt.y}deg` : "0deg",
              "--glare-x": `${isActive ? tilt.glareX : 50}%`,
              "--glare-y": `${isActive ? tilt.glareY : 50}%`,
              opacity: placed ? 1 : 0,
              zIndex: zIndexOf(index),
              transitionDelay: phase === "dealing" ? `${index * DEAL_STEP_MS}ms` : "0ms",
              // La carte ouverte en grand est masquée dans l'éventail.
              visibility: opened?.index === index ? "hidden" : undefined,
            } as CSSProperties;
            return (
              <li key={card.slug} className="hero-fan-card" style={style} data-active={isActive || undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la carte */}
                <img src={card.thumb} alt="" aria-hidden="true" className="hero-fan-glow" />
                <Link
                  ref={(node) => {
                    faces.current[index] = node;
                  }}
                  href={card.href}
                  className="hero-fan-face"
                  aria-haspopup="dialog"
                  onClick={(event) => openCard(event, index)}
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
        {/* Zones de survol : la place de chaque carte au repos, qui ne bouge jamais ; seul leur ordre
            change (la carte active passe dessus, sa zone ne fait donc que grandir). Si le pointeur
            suivait les cartes animées, elles se déroberaient sous lui : la carte soulevée le quitte par
            le bas, et en quittant une carte l'éventail se remet au repos le temps d'une image, ce qui
            faisait sauter à la carte du centre. Hors de la liste, que le glitch découpe et décale. */}
        <div className="absolute inset-0" aria-hidden="true">
          {cards.map((card, index) => {
            const offset = index - middle;
            const hitStyle = {
              "--fan-x": `${offset * 32}%`,
              "--fan-y": `${Math.abs(offset) * 3.5}%`,
              "--fan-r": `${offset * 6}deg`,
              zIndex: zIndexOf(index),
              visibility: opened?.index === index ? "hidden" : undefined,
            } as CSSProperties;
            return (
              <div key={card.slug} className="hero-fan-hit" style={hitStyle} data-active={active === index || undefined}>
                <Link
                  href={card.href}
                  tabIndex={-1}
                  onClick={(event) => openCard(event, index)}
                  onPointerMove={(event) => onPointerMove(event, index)}
                  onPointerEnter={() => phase === "open" && setActive(index)}
                  onPointerLeave={release}
                />
              </div>
            );
          })}
        </div>
      </div>
      {opened ? (
        <CardDialog card={cards[opened.index]} origin={opened.origin} originOf={originOf} labels={labels} onClosed={closeCard} />
      ) : null}
    </>
  );
}

/** Transformation qui ramène la carte agrandie (rect `to`) sur sa place dans l'éventail. */
function flipFrom({ rect: from, angle }: Spot, to: DOMRect) {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  // Rect d'une carte tournée : sa boîte englobante est plus large ; on retrouve sa largeur réelle.
  const radians = (Math.abs(angle) * Math.PI) / 180;
  const ratio = 2.5 / 3.5;
  const width = from.width / (Math.cos(radians) + Math.sin(radians) / ratio);
  return `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(${width / to.width})`;
}

function CardDialog({
  card,
  origin,
  originOf,
  labels,
  onClosed,
}: {
  card: FanCard;
  origin: Spot;
  originOf: () => Spot | null;
  labels: FanLabels;
  onClosed: () => void;
}) {
  // État d'animation (enter → open → leave) posé directement sur l'élément, sans rendu React : rien ne
  // recalcule pendant que la carte et la fiche bougent.
  const rootRef = useRef<HTMLDivElement>(null);
  const setState = (state: "open" | "leave") => {
    if (rootRef.current) rootRef.current.dataset.state = state;
  };
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const leaving = useRef(false);

  // FLIP : la carte part de sa place dans l'éventail et grandit jusqu'à sa place dans la fiche.
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    // Mouvement réduit : la fiche s'affiche directement à sa place.
    if (!reducedMotion()) {
      element.style.transition = "none";
      // Mesure la place finale sans transformation : en développement, React exécute cet effet deux
      // fois, et la seconde mesure lirait sinon la carte déjà ramenée sur l'éventail (aucun mouvement).
      element.style.transform = "";
      element.style.transform = flipFrom(origin, element.getBoundingClientRect());
    }
    // Deux images : la position de départ est peinte avant que la transition démarre (sinon saut).
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        element.style.transition = "";
        element.style.transform = "";
        setState("open");
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [origin]);

  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const element = cardRef.current;
    const back = originOf();
    if (!element || !back || reducedMotion()) {
      onClosed();
      return;
    }
    setState("leave");
    element.style.transform = flipFrom(back, element.getBoundingClientRect());
    // La carte reprend sa place dans l'éventail exactement à la fin de son retour.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      element.removeEventListener("transitionend", onEnd);
      onClosed();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === "transform") finish();
    };
    element.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, CLOSE_FALLBACK_MS);
  }, [onClosed, originOf]);

  // Voile compris (à côté de la fiche, dans le portail) : il doit rester cliquable pour fermer.
  // Le défilement de la page est bloqué avec une marge à la place de la barre : l'éventail ne bouge pas.
  useModal(rootRef, { onClose: close, initialFocus: closeRef });

  const stats = [
    { label: "COST", value: card.cost },
    { label: "PWR", value: card.power },
    { label: "RAM", value: card.ram },
  ].filter((stat) => stat.value !== null);
  const accent = ACCENTS[card.color ?? ""] ?? "var(--cyan)";

  return createPortal(
    <div ref={rootRef} className="card-dialog fixed inset-0 z-[70] overflow-y-auto overscroll-contain" data-state="enter">
      <div className="card-dialog-backdrop fixed inset-0 bg-background/90" onClick={close} aria-hidden="true" />
      {/* min-h-full : centrée si elle tient à l'écran, défilable depuis le haut sinon (téléphone). */}
      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="card-dialog-title"
          className="pointer-events-auto relative flex w-full max-w-4xl flex-col items-center gap-5 md:flex-row md:items-center md:gap-0"
        >
          {/* Déplacement et agrandissement (FLIP) sur l'enveloppe ; tour complet sur elle-même à l'intérieur. */}
          <div ref={cardRef} className="card-dialog-card relative z-10 aspect-card w-[min(58vw,230px)] shrink-0 md:w-[320px]">
            <div className="card-dialog-flip">
              <div className="card-dialog-face">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniature déjà chargée par l'éventail */}
                <img src={card.thumb} alt={card.alt} className="h-full w-full object-cover" />
              </div>
              {/* Dos de carte, visible pendant le tour : le vrai dos du jeu (CARD_BACK), sinon un dos HUD. */}
              <div className="card-dialog-back" aria-hidden="true">
                <span className="card-dialog-back-mark">TCG</span>
                <span className="card-dialog-back-sub">Tracker</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- image statique, masquée si absente */}
                <img
                  src={CARD_BACK}
                  alt=""
                  className="card-dialog-back-image"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              </div>
            </div>
          </div>
          <div className="card-dialog-panel w-full md:-ml-8 md:flex-1">
            <div className="cp-frame cp-cut">
              <div className="cp-frame-inner cp-cut relative flex flex-col gap-4 p-5 sm:p-7 md:pl-14">
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label={labels.close}
                  className="absolute top-3 right-3 grid size-10 place-items-center border border-line text-muted transition-colors hover:border-cyan hover:text-foreground"
                >
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
                <p className="cp-index pr-12" style={{ color: accent }}>
                  {`// ${card.kind}`}
                </p>
                <h2 id="card-dialog-title" className="cp-glitch is-glitching self-start pr-10 font-display text-2xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-3xl" data-text={card.name}>
                  {card.name}
                </h2>
                {stats.length ? (
                  <dl className="grid grid-cols-3 gap-2 sm:max-w-xs">
                    {stats.map((stat) => (
                      <div key={stat.label} className="border border-line bg-background/60 px-3 py-2">
                        <dt className="font-mono text-[11px] tracking-[0.18em] text-cyan">{stat.label}</dt>
                        <dd className="font-display text-2xl text-foreground">{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {card.rules ? (
                  <div className="border-l-2 pl-3 text-sm leading-6 text-muted" style={{ borderColor: accent }}>
                    <Rules text={card.rules} />
                  </div>
                ) : null}
                {card.price ? (
                  <p className="text-sm text-muted">
                    {labels.price} <span className="font-mono text-yellow">{card.price}</span>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3 pt-1">
                  <TrackCardLink printingId={card.printingId} label={labels.track} className="cp-btn" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
