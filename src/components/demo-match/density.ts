import type { CSSProperties } from "react";
import type { MatchState } from "@/lib/rules/demo-match-state";

function rowOverlap(count: number): string {
  if (count <= 1) return "0px";
  if (count <= 2) return "clamp(0.65rem, 1.5vmin, 1rem)";
  return "clamp(1.25rem, 3.5vmin, 2.25rem)";
}

function rivalOverlap(count: number): string {
  if (count <= 1) return "0px";
  if (count === 2) return "clamp(1.75rem, 4vh, 3rem)";
  if (count === 3) return "clamp(2.5rem, 6vh, 4rem)";
  return "clamp(3.25rem, 8vh, 5rem)";
}

/** Chevauchement juste suffisant pour que `count` cartes tiennent dans `avail` (au moins `min` × largeur). */
function fitOverlap(count: number, card: string, avail: string, min: number): string {
  if (count <= 1) return "0px";
  return `max(calc(var(${card}) * ${min}), calc((${count} * var(${card}) - ${avail}) / ${count - 1}))`;
}

export function demoDensityVars(state: MatchState, compact: boolean): CSSProperties {
  const fieldN = state.field.length + (state.pendingPlay ? 1 : 0);
  const rivalN = state.rivalField.length;
  const handN = state.hand.length;
  const gigN = Math.max(state.yourGigs.length, state.rivalGigs.length);

  if (compact) {
    // Tailles en unités de conteneur (cf. .demo-match--compact) : on ne chevauche que si la place manque.
    return {
      "--dm-hand-overlap": fitOverlap(handN, "--dm-card-hand", "100cqw - 1rem", 0.2),
      "--dm-row-overlap": fitOverlap(fieldN, "--dm-card-md", "var(--dm-field-avail)", 0),
      "--dm-rival-overlap": fitOverlap(rivalN, "--dm-card-rival", "100cqw - 7.5rem", 0.15),
    } as CSSProperties;
  }

  const vars: Record<string, string> = {
    // La largeur des cartes suit la hauteur de la main : chevauchement relatif, élargi si la place manque.
    "--dm-hand-overlap": fitOverlap(handN, "--dm-card-hand", "100cqw - 1rem", 0.4),
    "--dm-row-overlap": rowOverlap(fieldN),
    "--dm-rival-overlap": rivalOverlap(rivalN),
  };

  if (fieldN >= 4) vars["--dm-card-md"] = "clamp(3.75rem, 9vh, 7.5rem)";
  else if (fieldN === 3) vars["--dm-card-md"] = "clamp(4rem, 10vh, 8.25rem)";

  if (gigN >= 5) vars["--dm-gig"] = "clamp(1.45rem, 2.6vmin, 2rem)";
  else if (gigN >= 4) vars["--dm-gig"] = "clamp(1.65rem, 3vmin, 2.35rem)";

  return vars;
}
