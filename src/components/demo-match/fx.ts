import type { CSSProperties } from "react";
import type { DemoTableCopy } from "@/lib/rules/demo-match";

type FxTone = "you" | "rival" | "info";

export const FX_COLOR: Record<FxTone, string> = {
  you: "#f5e642",
  rival: "#ff5d6c",
  info: "#3ee0ff",
};

export type Fx = {
  tone: FxTone;
  banner?: string;
  sub?: string;
  shake?: boolean;
  vignette?: boolean;
  hold?: boolean;
  confetti?: boolean;
};

/** Effet visuel associé à chaque action du tutoriel (state.flash). */
export function fxFor(flash: string | null, copy: DemoTableCopy): Fx | null {
  if (!flash) return null;
  const f = copy.fx;
  if (flash.startsWith("gig-")) return { tone: "you", banner: f.gig, sub: f.streetCred(flash.slice(4)) };
  if (flash.startsWith("play-")) return { tone: "you", banner: f.deployed };
  switch (flash) {
    case "begin":
      return { tone: "you", banner: f.begin, vignette: true };
    case "sell":
      return { tone: "you", banner: f.sell };
    case "call-legend":
      return { tone: "info", banner: f.legend, vignette: true };
    case "equip":
      return { tone: "info", banner: f.equip };
    case "steal":
      return { tone: "you", banner: f.steal, shake: true, vignette: true };
    case "fight":
      return { tone: "you", banner: f.fight, shake: true, vignette: true };
    case "end-turn":
      return { tone: "rival", banner: f.rivalTurn };
    case "rival-play":
      return { tone: "rival", banner: f.rivalPlay };
    case "rival-attack":
    case "rival-attack-gigs":
      return { tone: "rival", banner: f.attack, shake: true, vignette: true };
    case "rival-steal":
      return { tone: "rival", banner: f.lost, shake: true, vignette: true };
    case "block":
      return { tone: "info", banner: f.block, shake: true, vignette: true };
    case "finale":
      return { tone: "you", banner: f.win, sub: f.winSub, hold: true, confetti: true, vignette: true };
    default:
      return null;
  }
}

const CONFETTI_COLORS = ["#f5e642", "#3ee0ff", "#ff2ea6", "#ffffff"];
export const CONFETTI = Array.from({ length: 48 }, (_, i) => {
  const angle = (i / 48) * Math.PI * 2 + (i % 3) * 0.35;
  const dist = 0.55 + ((i * 37) % 45) / 100;
  return {
    "--x": `${(Math.cos(angle) * 42 * dist).toFixed(1)}cqw`,
    "--y": `${(Math.sin(angle) * 34 * dist - 12).toFixed(1)}cqh`,
    "--r": `${((i * 47) % 360) - 180}deg`,
    "--d": `${(i % 6) * 45}ms`,
    "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  } as CSSProperties;
});

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
