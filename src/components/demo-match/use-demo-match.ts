import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDemoSteps, useDemoTableCopy } from "@/lib/rules/use-rules";
import { playCardMoves, takeFlipSnapshot, type FlipSnapshot } from "@/components/demo-card-moves";
import { matchesExpect } from "@/lib/rules/demo-match";
import { initialMatchState, type MatchState } from "@/lib/rules/demo-match-state";
import { fxFor, prefersReducedMotion } from "./fx";

/** État de la partie guidée, avancée des étapes et animations du plateau. */
export function useDemoMatch(onProgress?: (step: number, total: number) => void) {
  const copy = useDemoTableCopy();
  const steps = useDemoSteps();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<MatchState>(() => initialMatchState());
  const [toast, setToast] = useState<string | null>(null);
  // fxSeq rejoue les effets à chaque action ; round redistribue tout au « Rejouer ».
  const [fxSeq, setFxSeq] = useState(0);
  const [round, setRound] = useState(0);
  const lunges = useRef<{ you: string[]; rival: string[] }>({ you: [], rival: [] });
  const tableRef = useRef<HTMLDivElement>(null);
  const flipSnap = useRef<FlipSnapshot | null>(null);

  const step = steps[stepIndex];
  const expect = step.expect;
  const done = expect.kind === "done";

  useEffect(() => {
    onProgress?.(stepIndex + 1, steps.length);
  }, [onProgress, stepIndex, steps.length]);

  function tryAction(action: Parameters<typeof matchesExpect>[1]) {
    if (done) return;
    if (!matchesExpect(expect, action)) {
      setToast(copy.wrong);
      window.setTimeout(() => setToast(null), 1400);
      return;
    }
    const next = step.apply(state);
    flipSnap.current =
      tableRef.current && !prefersReducedMotion() ? takeFlipSnapshot(tableRef.current, state) : null;
    // Cartes qui viennent d'attaquer / bloquer : elles bondissent vers leur cible.
    const wasSpent = new Set(state.field.filter((c) => c.spent).map((c) => c.id));
    lunges.current = {
      you: next.field.filter((c) => c.spent && !wasSpent.has(c.id)).map((c) => c.id),
      rival: next.rivalAttackerId && next.rivalAttackerId !== state.rivalAttackerId ? [next.rivalAttackerId] : [],
    };
    setState({ ...next, flash: next.flash });
    setFxSeq((n) => n + 1);
    setToast(null);
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function restart() {
    flipSnap.current = null;
    setState(initialMatchState());
    setStepIndex(0);
    setToast(null);
    lunges.current = { you: [], rival: [] };
    setRound((n) => n + 1);
  }

  const fx = fxSeq > 0 ? fxFor(state.flash, copy) : null;
  const shake = Boolean(fx?.shake);

  // Web Animations : rejouables sans remonter les cartes (qui rejoueraient leur arrivée).
  useEffect(() => {
    const table = tableRef.current;
    if (!table || fxSeq === 0 || prefersReducedMotion()) return;
    const lunge = (id: string, dir: 1 | -1, glow: string) =>
      table.querySelector(`[data-fx-id="${id}"]`)?.animate(
        [
          { transform: "none" },
          {
            transform: `translateY(${dir * 34}%) scale(1.15) rotate(${dir * 4}deg)`,
            filter: `drop-shadow(0 0 16px ${glow})`,
            offset: 0.35,
          },
          { transform: "none" },
        ],
        { duration: 560, easing: "cubic-bezier(0.5, 0, 0.3, 1)" },
      );
    lunges.current.you.forEach((id) => lunge(id, -1, "rgba(245, 230, 66, 0.9)"));
    lunges.current.rival.forEach((id) => lunge(id, 1, "rgba(255, 93, 108, 0.9)"));
    lunges.current = { you: [], rival: [] };
  }, [fxSeq]);

  // Cartes qui changent de zone : elles volent de l'ancienne position à la nouvelle (avant peinture).
  useLayoutEffect(() => {
    const snap = flipSnap.current;
    flipSnap.current = null;
    if (snap && tableRef.current) playCardMoves(tableRef.current, snap, state);
  }, [state]);

  // Impact : le plateau tremble.
  useEffect(() => {
    if (!shake || prefersReducedMotion()) return;
    tableRef.current?.animate(
      [
        { translate: "0 0" },
        { translate: "-5px 1px" },
        { translate: "5px -1px" },
        { translate: "-4px 0" },
        { translate: "3px 1px" },
        { translate: "-1px 0" },
        { translate: "0 0" },
      ],
      { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
    );
  }, [fxSeq, shake]);

  return { copy, steps, stepIndex, step, expect, done, state, toast, fxSeq, round, fx, tableRef, tryAction, restart };
}
