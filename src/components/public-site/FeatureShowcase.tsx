"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

export type ShowcaseFeature = { key: string; title: string; body: string; points: string[]; href: string; external: boolean };

/** Textes des aperçus (bloc landing.showcase). */
export type ShowcaseText = {
  completion: string;
  value: string;
  legal: string[];
  missing: string;
  round: string;
  table: string;
  live: string;
  verified: string;
  nextEvent: string;
  store: string;
  gigs: string;
  win: string;
  price: string;
  red: string;
  green: string;
};

export type ShowcaseData = {
  text: ShowcaseText;
  /** Coût d'exemple des cartes manquantes, au format de la langue. */
  missingCost: string;
  legends: { name: string; thumb: string }[];
  sample: { name: string; thumb: string; cost: number | null; power: number | null; ram: number | null; price: string | null } | null;
  totalCards: number;
};

type Labels = { preview: string; example: string; open: string };

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const list = window.matchMedia(REDUCED_MOTION);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Durée d'affichage d'un module avant de passer au suivant (défilement automatique). */
const SLIDE_MS = 7000;
/** Pas du minuteur (et de la barre de progression). */
const TICK_MS = 100;
/** Molette : défilement cumulé qui fait changer de module, puis délai avant le changement suivant. */
const WHEEL_STEP = 50;
const WHEEL_COOLDOWN_MS = 450;

/**
 * Modules de l'accueil, en carrousel : un menu à gauche (comme les menus du jeu vidéo) et, pour le
 * module affiché, une mini-interface qui montre ce que l'on fait dans l'application.
 * - Molette au-dessus du carrousel : passe au module suivant ou précédent, un module par geste ; au
 *   premier ou au dernier module, la molette fait de nouveau défiler la page. Ailleurs, la page défile
 *   normalement.
 * - Le carrousel avance aussi seul, s'arrête au survol, au focus et hors écran, et ne défile pas seul
 *   si l'utilisateur préfère réduire les animations.
 * Les visuels sont des exemples (sauf les cartes, réelles) et sont signalés comme tels.
 */
export function FeatureShowcase({
  features,
  data,
  labels,
  header,
}: {
  features: ShowcaseFeature[];
  data: ShowcaseData;
  labels: Labels;
  /** Titre de la section. */
  header: ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const count = features.length;
  const running = !reducedMotion && !hovered && !focused && visible;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Téléphone : l'onglet actif reste visible dans la bande défilante (sans faire défiler la page).
    const list = listRef.current;
    const tab = document.getElementById(`module-tab-${current}`);
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: tab.offsetLeft - 16, behavior: "smooth" });
  }, [current]);

  const elapsed = useRef(0);
  const [progress, setProgress] = useState(0);

  // Défilement automatique : avance par pas de TICK_MS, puis passe au module suivant.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      elapsed.current += TICK_MS;
      if (elapsed.current >= SLIDE_MS) {
        elapsed.current = 0;
        setCurrent((value) => (value + 1) % count);
      }
      setProgress(elapsed.current / SLIDE_MS);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, count]);

  // Molette au-dessus du carrousel : change de module au lieu de faire défiler la page.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let accumulated = 0;
    let lockedUntil = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const direction = Math.sign(event.deltaY);
      const index = currentRef.current;
      // Au bout du carrousel, la molette fait défiler la page.
      if ((direction > 0 && index >= count - 1) || (direction < 0 && index <= 0)) {
        accumulated = 0;
        return;
      }
      event.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) return;
      // Pavé tactile : petits deltas cumulés ; molette : un cran suffit.
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : event.deltaY * 40;
      accumulated = Math.sign(accumulated) === direction ? accumulated + delta : delta;
      if (Math.abs(accumulated) < WHEEL_STEP) return;
      accumulated = 0;
      lockedUntil = now + WHEEL_COOLDOWN_MS;
      elapsed.current = 0;
      setProgress(0);
      setCurrent(index + direction);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [count]);

  function select(index: number, focus = false) {
    const next = (index + count) % count;
    if (focus) document.getElementById(`module-tab-${next}`)?.focus({ preventScroll: true });
    elapsed.current = 0;
    setProgress(0);
    setCurrent(next);
  }

  return (
    <div className="relative">
      <div>
        <div className="mx-auto w-full max-w-[1100px] px-3 py-16 sm:px-4">
          {header}
          <div
            ref={rootRef}
            className="grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-10"
            aria-roledescription="carousel"
            onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
            }}
          >
            <div className="flex flex-col gap-4" data-reveal="left">
              <div
                ref={listRef}
                role="tablist"
                aria-orientation="vertical"
                aria-label={labels.preview}
                className="scrollbar-hud -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0"
              >
                {features.map((item, index) => {
                  const selected = index === current;
                  return (
                    <button
                      key={item.key}
                      id={`module-tab-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`module-panel-${index}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => select(index)}
                      onKeyDown={(event) => {
                        const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
                        if (!step) return;
                        event.preventDefault();
                        select(index + step, true);
                      }}
                      className={`group relative flex shrink-0 items-center gap-3 overflow-hidden border-l-2 px-4 py-3 text-left transition-colors lg:py-4 ${
                        selected ? "border-yellow bg-yellow/10 text-yellow" : "border-line text-muted hover:border-cyan hover:text-foreground"
                      }`}
                    >
                      <span className={`font-mono text-xs ${selected ? "" : "text-muted"}`} style={selected ? { color: "var(--cp-red)" } : undefined}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-sm font-semibold uppercase tracking-wider whitespace-nowrap lg:text-base">{item.title}</span>
                      {selected ? (
                        // Barre de progression du minuteur.
                        <span
                          aria-hidden="true"
                          className="cp-progress absolute bottom-0 left-0 h-0.5 w-full bg-yellow"
                          style={{ transform: `scaleX(${progress})` } as CSSProperties}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enveloppe d'apparition : le cadre a déjà son propre clip-path (coins coupés). */}
            <div data-reveal="right" style={{ "--reveal-delay": "150ms" } as CSSProperties}>
              <div className="cp-frame cp-cut">
                {/* Tous les modules sont rendus (texte indexable) ; seul l'actif est affiché. Son animation
                    d'entrée rejoue à chaque affichage (display none → visible). Le visuel, décoratif,
                    n'est rendu que pour le module actif, qui porte seul les cibles de GlitchDirector. */}
                {features.map((item, index) => {
                  const selected = index === current;
                  return (
                    <div
                      key={item.key}
                      id={`module-panel-${index}`}
                      role="tabpanel"
                      aria-labelledby={`module-tab-${index}`}
                      hidden={!selected}
                      className="cp-frame-inner cp-cut"
                    >
                      <div className="cp-module-in grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_1.1fr]">
                        <div className="flex flex-col gap-4">
                          <p className="cp-index">
                            {`${String(index + 1).padStart(2, "0")} // ${labels.preview}`}
                          </p>
                          <h3
                            className="cp-glitch self-start font-display text-2xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-3xl"
                            data-text={item.title}
                            data-glitch={selected ? "module-title" : undefined}
                          >
                            {item.title}
                          </h3>
                          <p className="text-base leading-7 text-muted">{item.body}</p>
                          <ul className="flex flex-col gap-2.5">
                            {item.points.map((point) => (
                              <li key={point} className="flex items-start gap-3 text-sm text-foreground">
                                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-cyan" />
                                {point}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-auto pt-2">
                            <Link href={item.href} rel={item.external ? "nofollow" : undefined} className="cp-btn">
                              {labels.open}
                              <span className="sr-only">{` — ${item.title}`}</span>
                            </Link>
                          </div>
                        </div>
                        <div className="cp-glitch-block relative min-h-64 border border-line bg-background/60 p-4" data-glitch={selected ? "module-visual" : undefined}>
                          <span className="absolute top-2 right-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{labels.example}</span>
                          {selected ? <Visual feature={item.key} data={data} /> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Segments({ total, filled, tone = "yellow" }: { total: number; filled: number; tone?: "yellow" | "cyan" | "red" }) {
  const color = tone === "yellow" ? "var(--yellow)" : tone === "cyan" ? "var(--cyan)" : "var(--cp-red)";
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className="h-2.5 flex-1" style={{ background: index < filled ? color : "var(--line)" }} />
      ))}
    </div>
  );
}

function HudLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] tracking-[0.18em] text-cyan uppercase">{children}</p>;
}

function Visual({ feature, data }: { feature: string; data: ShowcaseData }) {
  const m = data.text;
  switch (feature) {
    case "collection": {
      const owned = Math.round(data.totalCards * 0.78);
      const points = [12, 18, 15, 24, 22, 31, 29, 38, 41, 39, 48, 55];
      const path = points.map((value, index) => `${(index / (points.length - 1)) * 300},${100 - value * 1.6}`).join(" ");
      return (
        <div className="flex h-full flex-col gap-5 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <HudLabel>{m.completion}</HudLabel>
              <span className="font-mono text-sm text-foreground">
                {owned} / {data.totalCards}
              </span>
            </div>
            <Segments total={20} filled={Math.round((owned / Math.max(1, data.totalCards)) * 20)} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <HudLabel>{m.value}</HudLabel>
              <span className="font-mono text-sm">
                <span className="text-yellow">248,60 €</span> <span style={{ color: "var(--gain)" }}>+12,4 %</span>
              </span>
            </div>
            <svg viewBox="0 0 300 100" className="h-32 w-full" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cp-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--cyan)" stopOpacity="0.35" />
                  <stop offset="1" stopColor="var(--cyan)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[25, 50, 75].map((y) => (
                <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
              ))}
              <polygon points={`0,100 ${path} 300,100`} fill="url(#cp-area)" />
              <polyline points={path} fill="none" stroke="var(--cyan)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        </div>
      );
    }
    case "decks":
      return (
        <div className="flex h-full flex-col gap-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {data.legends.slice(0, 3).map((legend) => (
              // eslint-disable-next-line @next/next/no-img-element -- miniatures pré-générées
              <img key={legend.name} src={legend.thumb} alt="" className="cp-cut aspect-card w-full object-cover" style={{ ["--cut" as string]: "8px" }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <HudLabel>RAM {m.red}</HudLabel>
              <Segments total={6} filled={4} tone="red" />
            </div>
            <div className="flex flex-col gap-1.5">
              <HudLabel>RAM {m.green}</HudLabel>
              <Segments total={6} filled={2} tone="cyan" />
            </div>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {m.legal.map((rule) => (
              <li key={rule} className="flex items-center gap-1.5">
                <span style={{ color: "var(--gain)" }}>✓</span>
                {rule}
              </li>
            ))}
          </ul>
          <p className="font-mono text-sm text-yellow">{m.missing} · {data.missingCost}</p>
        </div>
      );
    case "tournaments": {
      const pairings = [
        ["Panam", "Jackie", "2-1"],
        ["Judy", "River", "0-2"],
        ["Kerry", "Rogue", "…"],
      ];
      return (
        <div className="flex h-full flex-col gap-4 pt-4">
          <div className="flex items-end justify-between">
            <HudLabel>{m.round}</HudLabel>
            <span className="font-display text-4xl font-bold text-yellow tabular-nums">42:17</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {pairings.map(([a, b, score], index) => (
              <li key={a} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 border border-line bg-panel px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted">
                  {m.table} {index + 1}
                </span>
                <span className="text-right">{a}</span>
                <span className="font-mono text-cyan">{score}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--cp-red)" }} aria-hidden="true" />
            {m.live}
          </p>
        </div>
      );
    }
    case "cards":
      return data.sample ? (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- miniature pré-générée */}
          <img src={data.sample.thumb} alt="" className="cp-cut aspect-card w-full object-cover" style={{ ["--cut" as string]: "12px" }} />
          <div className="flex flex-col gap-3">
            <p className="font-display text-lg font-bold uppercase leading-tight text-foreground">{data.sample.name}</p>
            {[
              ["COST", data.sample.cost],
              ["PWR", data.sample.power],
              ["RAM", data.sample.ram],
            ]
              .filter(([, value]) => value !== null)
              .map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between border-b border-line pb-1">
                  <HudLabel>{label}</HudLabel>
                  <span className="font-display text-xl text-yellow">{value}</span>
                </div>
              ))}
            {data.sample.price ? (
              <div className="flex items-center justify-between">
                <HudLabel>{m.price}</HudLabel>
                <span className="font-mono text-sm">{data.sample.price}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null;
    case "shops":
      return (
        <div className="flex h-full flex-col gap-4 pt-4">
          <div
            className="relative h-40 border border-line"
            style={{
              backgroundImage: "linear-gradient(var(--hud-border) 1px, transparent 1px), linear-gradient(90deg, var(--hud-border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden="true"
          >
            {[
              { left: "22%", top: "30%", main: false },
              { left: "58%", top: "48%", main: true },
              { left: "78%", top: "22%", main: false },
              { left: "40%", top: "72%", main: false },
            ].map((pin) => (
              <span
                key={pin.left}
                className="absolute -translate-x-1/2 -translate-y-1/2 rotate-45"
                style={{
                  left: pin.left,
                  top: pin.top,
                  width: pin.main ? 16 : 10,
                  height: pin.main ? 16 : 10,
                  background: pin.main ? "var(--yellow)" : "var(--cyan)",
                  boxShadow: pin.main ? "0 0 0 6px rgba(245, 230, 66, 0.18)" : undefined,
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 border border-yellow/50 bg-panel p-3">
            <span className="grid size-10 place-items-center bg-yellow font-display font-bold text-black">N</span>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 text-sm text-foreground">
                {m.store}
                <span className="border border-yellow/60 px-1 text-[10px] text-yellow">✓ {m.verified}</span>
              </span>
              <span className="text-xs text-muted">{m.nextEvent}</span>
            </div>
          </div>
        </div>
      );
    case "howToPlay":
      return (
        <div className="flex h-full flex-col gap-5 pt-4">
          <div className="grid grid-cols-6 gap-2">
            {["d4", "d6", "d8", "d10", "d12", "d20"].map((die, index) => (
              <span
                key={die}
                className="cp-cut grid aspect-square place-items-center font-mono text-xs"
                style={{
                  ["--cut" as string]: "6px",
                  background: index < 4 ? "var(--yellow)" : "var(--panel-2)",
                  color: index < 4 ? "#000" : "var(--muted)",
                }}
              >
                {die}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <HudLabel>{m.gigs}</HudLabel>
              <span className="font-display text-2xl font-bold text-yellow">5 / 7</span>
            </div>
            <Segments total={7} filled={5} />
          </div>
          <p className="text-sm text-muted">{m.win}</p>
        </div>
      );
    default:
      return null;
  }
}
