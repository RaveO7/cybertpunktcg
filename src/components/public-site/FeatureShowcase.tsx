"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export type ShowcaseFeature = { key: string; title: string; body: string; points: string[]; href: string; external: boolean };

export type ShowcaseData = {
  locale: "fr" | "en";
  legends: { name: string; thumb: string }[];
  sample: { name: string; thumb: string; cost: number | null; power: number | null; ram: number | null; price: string | null } | null;
  totalCards: number;
};

type Labels = { preview: string; example: string; open: string };

/**
 * Modules de l'accueil : un menu à gauche (comme les menus du jeu vidéo), et pour le module choisi
 * une mini-interface qui montre ce que l'on fait dans l'application. Les visuels sont des exemples
 * (sauf les cartes, réelles) et sont signalés comme tels.
 */
export function FeatureShowcase({ features, data, labels }: { features: ShowcaseFeature[]; data: ShowcaseData; labels: Labels }) {
  const [current, setCurrent] = useState(0);
  const feature = features[current];

  function select(index: number, focus = false) {
    setCurrent(index);
    if (focus) document.getElementById(`module-tab-${index}`)?.focus();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-10">
      <div
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
              aria-controls="module-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
                if (!step) return;
                event.preventDefault();
                select((index + step + features.length) % features.length, true);
              }}
              className={`group relative flex shrink-0 items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors lg:py-4 ${
                selected ? "border-yellow bg-yellow/10 text-yellow" : "border-line text-muted hover:border-cyan hover:text-foreground"
              }`}
            >
              <span className={`font-mono text-xs ${selected ? "" : "text-muted"}`} style={selected ? { color: "var(--cp-red)" } : undefined}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-sm font-semibold uppercase tracking-wider whitespace-nowrap lg:text-base">{item.title}</span>
              {selected ? <span aria-hidden="true" className="ml-auto hidden h-2 w-2 bg-yellow lg:block" /> : null}
            </button>
          );
        })}
      </div>

      <div className="cp-frame cp-cut">
        <div id="module-panel" role="tabpanel" aria-labelledby={`module-tab-${current}`} className="cp-frame-inner cp-cut">
          <div key={feature.key} className="cp-module-in grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col gap-4">
              <p className="cp-index">
                {`${String(current + 1).padStart(2, "0")} // ${labels.preview}`}
              </p>
              <h3 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-3xl">{feature.title}</h3>
              <p className="text-base leading-7 text-muted">{feature.body}</p>
              <ul className="flex flex-col gap-2.5">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-foreground">
                    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-cyan" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Link href={feature.href} rel={feature.external ? "nofollow" : undefined} className="cp-btn">
                  {labels.open}
                </Link>
              </div>
            </div>
            <div className="relative min-h-64 border border-line bg-background/60 p-4">
              <span className="absolute top-2 right-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{labels.example}</span>
              <Visual feature={feature.key} data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK = {
  fr: {
    completion: "Complétion",
    value: "Valeur",
    legal: ["3 Légendes", "45 cartes", "RAM respectée"],
    missing: "Manque 3 cartes",
    round: "Ronde 3 / 5",
    table: "Table",
    live: "Classement en direct",
    verified: "Vérifiée",
    nextEvent: "Prochain tournoi : samedi 14 h",
    store: "Boutique de Night City",
    gigs: "Gigs",
    win: "7 Gigs au début de votre tour : victoire",
    price: "Prix",
    red: "Rouge",
    green: "Vert",
  },
  en: {
    completion: "Completion",
    value: "Value",
    legal: ["3 Legends", "45 cards", "RAM within limit"],
    missing: "3 cards missing",
    round: "Round 3 / 5",
    table: "Table",
    live: "Live standings",
    verified: "Verified",
    nextEvent: "Next tournament: Saturday 2 pm",
    store: "Night City store",
    gigs: "Gigs",
    win: "7 Gigs at the start of your turn: you win",
    price: "Price",
    red: "Red",
    green: "Green",
  },
};

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
  const m = MOCK[data.locale];
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
          <p className="font-mono text-sm text-yellow">{m.missing} · 7,80 €</p>
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
