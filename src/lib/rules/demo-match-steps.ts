import type { Messages } from "@/i18n/load";
import {
  beginPlay,
  draw,
  finishPendingGear,
  finishPendingUnit,
  flipOneLegend,
  readyYourCards,
  removeHand,
  rivalAttack,
  nid,
  spendOneEddie,
  spendOneLegend,
  takeFixer,
  type CardRef,
  type MatchState,
} from "@/lib/rules/demo-match-state";

export type ExpectAction =
  | { kind: "begin" }
  | { kind: "die"; die: string }
  | { kind: "hand"; card: CardRef }
  | { kind: "field"; ref: CardRef }
  | { kind: "target-gigs" }
  | { kind: "target-rival"; ref?: CardRef }
  | { kind: "end-turn" }
  | { kind: "continue" }
  | { kind: "eddie" }
  | { kind: "legend" }
  | { kind: "call-legend" }
  | { kind: "done" };

/** Textes d'une étape de la partie guidée (bloc rules.demoMatch.steps). */
export type StepCopy = { tip: string; title: string; explain: string };
export type DemoStepsText = Messages["rules"]["demoMatch"]["steps"];

export type InteractiveStep = {
  id: string;
  tip: string;
  title: string;
  explain: string;
  /** data-coach-id of the element the popup should point to */
  anchor: string;
  expect: ExpectAction;
  apply: (state: MatchState) => MatchState;
};

/** Étapes de la partie guidée, avec leurs textes dans une langue (bloc rules.demoMatch.steps). */
export function buildInteractiveSteps(text: DemoStepsText): InteractiveStep[] {
  const copy = (id: string): StepCopy => {
    const step = (text as Record<string, StepCopy | undefined>)[id];
    if (!step) throw new Error(`Textes manquants pour l'étape ${id}`);
    return step;
  };

  return [
    {
      id: "begin",
      ...copy("begin"),
      anchor: "coach-begin",
      expect: { kind: "begin" },
      apply: (s) => ({ ...s, phase: "you", turn: 1, flash: "begin" }),
    },
    {
      id: "intro-types",
      ...copy("intro-types"),
      anchor: "coach-hand-zone",
      expect: { kind: "continue" },
      apply: (s) => ({ ...s, flash: "intro-types" }),
    },
    {
      id: "intro-legends",
      ...copy("intro-legends"),
      anchor: "coach-legends",
      expect: { kind: "continue" },
      apply: (s) => ({ ...s, flash: "intro-legends" }),
    },
    {
      id: "t1-die",
      ...copy("t1-die"),
      anchor: "coach-die-d6",
      expect: { kind: "die", die: "d6" },
      apply: (s) => takeFixer(draw(s, "unitSmasher"), "d6", 6),
    },
    {
      id: "t1-sell",
      ...copy("t1-sell"),
      anchor: "coach-hand-eddieFace",
      expect: { kind: "hand", card: "eddieFace" },
      apply: (s) => {
        const next = removeHand(s, "eddieFace");
        return {
          ...next,
          eddies: [...next.eddies, { id: nid("edd"), ref: "eddieFace", faceDown: true }],
          flash: "sell",
        };
      },
    },
    {
      id: "t1-play",
      ...copy("t1-play"),
      anchor: "coach-hand-unitBlocker",
      expect: { kind: "hand", card: "unitBlocker" },
      apply: (s) => beginPlay(s, "unitBlocker", "unit"),
    },
    {
      id: "t1-pay-eddie",
      ...copy("t1-pay-eddie"),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t1-pay-legend-1",
      ...copy("t1-pay-legend-1"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t1-pay-legend-2",
      ...copy("t1-pay-legend-2"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t1-pay-legend-3",
      ...copy("t1-pay-legend-3"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t1-end",
      ...copy("t1-end"),
      anchor: "coach-end-turn",
      expect: { kind: "end-turn" },
      apply: (s) => ({ ...s, phase: "rival", flash: "end-turn" }),
    },
    {
      id: "r1-ready",
      ...copy("r1-ready"),
      anchor: "coach-rival-field",
      expect: { kind: "continue" },
      apply: (s) => ({
        ...s,
        phase: "rival",
        rivalField: s.rivalField.map((c) => ({ ...c, spent: false })),
        rivalAttackerId: null,
        flash: "rival-ready",
      }),
    },
    {
      id: "r1-gig",
      ...copy("r1-gig"),
      anchor: "coach-rival-gigs",
      expect: { kind: "continue" },
      apply: (s) => ({
        ...s,
        rivalGigs: [...s.rivalGigs, 8],
        flash: "rival-gig",
      }),
    },
    {
      id: "r1-play",
      ...copy("r1-play"),
      anchor: "coach-rival-field",
      expect: { kind: "continue" },
      apply: (s) => ({
        ...s,
        rivalField: [{ id: nid("riv"), ref: "unitJackie" }, ...s.rivalField],
        flash: "rival-play",
      }),
    },
    {
      id: "r1-attack",
      ...copy("r1-attack"),
      anchor: "coach-rival-field",
      expect: { kind: "continue" },
      apply: (s) => rivalAttack(s, "unitBlocker", "rival-attack"),
    },
    {
      id: "r1-steal",
      ...copy("r1-steal"),
      anchor: "coach-your-gigs",
      expect: { kind: "continue" },
      apply: (s) => {
        const lost = s.yourGigs[s.yourGigs.length - 1];
        return {
          ...s,
          yourGigs: s.yourGigs.slice(0, -1),
          rivalGigs: lost != null ? [...s.rivalGigs, lost] : s.rivalGigs,
          rivalAttackerId: null,
          phase: "you",
          turn: 2,
          flash: "rival-steal",
        };
      },
    },
    {
      id: "t2-die",
      ...copy("t2-die"),
      anchor: "coach-die-d8",
      expect: { kind: "die", die: "d8" },
      apply: (s) => takeFixer(draw(readyYourCards(s), "programReaper"), "d8", 8),
    },
    {
      id: "t2-sell",
      ...copy("t2-sell"),
      anchor: "coach-hand-programDetonate",
      expect: { kind: "hand", card: "programDetonate" },
      apply: (s) => {
        const next = removeHand(s, "programDetonate");
        return {
          ...next,
          eddies: [...next.eddies, { id: nid("edd"), ref: "programDetonate", faceDown: true }],
          flash: "sell",
        };
      },
    },
    {
      id: "t2-gear",
      ...copy("t2-gear"),
      anchor: "coach-hand-gearConverter",
      expect: { kind: "hand", card: "gearConverter" },
      apply: (s) => beginPlay(s, "gearConverter", "gear"),
    },
    {
      id: "t2-gear-pay-1",
      ...copy("t2-gear-pay-1"),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t2-gear-pay-2",
      ...copy("t2-gear-pay-2"),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => finishPendingGear(spendOneEddie(s)),
    },
    {
      id: "t2-call-pay",
      ...copy("t2-call-pay"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t2-call-flip",
      ...copy("t2-call-flip"),
      anchor: "coach-legend-call",
      expect: { kind: "call-legend" },
      apply: (s) => flipOneLegend(s),
    },
    {
      id: "t2-end",
      ...copy("t2-end"),
      anchor: "coach-end-turn",
      expect: { kind: "end-turn" },
      apply: (s) => ({ ...s, phase: "rival", rivalAttackerId: null, flash: "end-turn" }),
    },
    {
      id: "r2-ready",
      ...copy("r2-ready"),
      anchor: "coach-rival-field",
      expect: { kind: "continue" },
      apply: (s) => ({
        ...s,
        phase: "rival",
        rivalField: s.rivalField.map((c) => ({ ...c, spent: false })),
        rivalAttackerId: null,
        flash: "rival-ready",
      }),
    },
    {
      id: "r2-gig",
      ...copy("r2-gig"),
      anchor: "coach-rival-gigs",
      expect: { kind: "continue" },
      apply: (s) => ({
        ...s,
        rivalGigs: [...s.rivalGigs, 4],
        flash: "rival-gig",
      }),
    },
    {
      id: "r2-attack",
      ...copy("r2-attack"),
      anchor: "coach-your-gigs",
      expect: { kind: "continue" },
      apply: (s) => rivalAttack(s, "unitBlocker", "rival-attack-gigs"),
    },
    {
      id: "r2-block",
      ...copy("r2-block"),
      anchor: "coach-field-unitBlocker",
      expect: { kind: "field", ref: "unitBlocker" },
      apply: (s) => {
        const attacker = s.rivalField.find((c) => c.id === s.rivalAttackerId);
        return {
          ...s,
          field: s.field.map((c) => (c.ref === "unitBlocker" ? { ...c, spent: true } : c)),
          rivalAttackerId: null,
          phase: "you",
          turn: 3,
          rivalField: s.rivalField.filter((c) => c.id !== attacker?.id),
          trash: attacker ? [...s.trash, attacker.ref] : s.trash,
          flash: "block",
        };
      },
    },
    {
      id: "t3-die",
      ...copy("t3-die"),
      anchor: "coach-die-d10",
      expect: { kind: "die", die: "d10" },
      apply: (s) => takeFixer(draw(readyYourCards(s), "eddieFace"), "d10", 10),
    },
    {
      id: "t3-play",
      ...copy("t3-play"),
      anchor: "coach-hand-unitAdrenaline",
      expect: { kind: "hand", card: "unitAdrenaline" },
      apply: (s) => beginPlay(s, "unitAdrenaline", "unit"),
    },
    {
      id: "t3-pay-eddie-1",
      ...copy("t3-pay-eddie-1"),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t3-pay-eddie-2",
      ...copy("t3-pay-eddie-2"),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t3-pay-legend-1",
      ...copy("t3-pay-legend-1"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t3-pay-legend-2",
      ...copy("t3-pay-legend-2"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t3-pay-legend-3",
      ...copy("t3-pay-legend-3"),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t3-atk-select",
      ...copy("t3-atk-select"),
      anchor: "coach-field-unitAdrenaline",
      expect: { kind: "field", ref: "unitAdrenaline" },
      apply: (s) => {
        const nomad = s.field.find((c) => c.ref === "unitAdrenaline" && !c.spent);
        return { ...s, selectedAttackerId: nomad?.id ?? null, flash: "select" };
      },
    },
    {
      id: "t3-atk-target",
      ...copy("t3-atk-target"),
      anchor: "coach-rival-gigs",
      expect: { kind: "target-gigs" },
      apply: (s) => {
        const stolen = s.rivalGigs[0];
        return {
          ...s,
          selectedAttackerId: null,
          rivalGigs: s.rivalGigs.slice(1),
          yourGigs: stolen != null ? [...s.yourGigs, stolen] : s.yourGigs,
          field: s.field.map((c) => (c.id === s.selectedAttackerId ? { ...c, spent: true } : c)),
          phase: "end",
          flash: "finale",
        };
      },
    },
    {
      id: "done",
      ...copy("done"),
      anchor: "coach-done",
      expect: { kind: "done" },
      apply: (s) => s,
    },
  ];
}
