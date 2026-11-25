import type { EXAMPLE_CARDS } from "@/lib/rules/examples";

export type CardRef = keyof typeof EXAMPLE_CARDS;

export type BoardCard = {
  id: string;
  ref: CardRef;
  spent?: boolean;
  faceDown?: boolean;
  equipped?: CardRef;
};

export type MatchState = {
  turn: 1 | 2 | 3;
  phase: "you" | "rival" | "setup" | "end";
  yourGigs: number[];
  rivalGigs: number[];
  fixer: string[];
  hand: CardRef[];
  field: BoardCard[];
  rivalField: BoardCard[];
  legends: BoardCard[];
  eddies: BoardCard[];
  trash: CardRef[];
  deckCount: number;
  selectedAttackerId: string | null;
  rivalAttackerId: string | null;
  /** Card being paid for (from hand) before it enters play */
  pendingPlay: CardRef | null;
  pendingKind: "unit" | "gear" | null;
  flash: string | null;
};

const HAND_START: CardRef[] = [
  "eddieFace",
  "unitAdrenaline",
  "programDetonate",
  "gearConverter",
  "unitBlocker",
  "unitJackie",
];

let idSeq = 0;
export function nid(prefix: string) {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

export function initialMatchState(): MatchState {
  idSeq = 0;
  return {
    turn: 1,
    phase: "setup",
    yourGigs: [],
    rivalGigs: [5],
    fixer: ["d4", "d6", "d8", "d10", "d12", "d20"],
    hand: [...HAND_START],
    field: [],
    rivalField: [{ id: nid("riv"), ref: "unitBlocker", spent: true }],
    legends: [
      { id: nid("leg"), ref: "legendJohnny", faceDown: true },
      { id: nid("leg"), ref: "legendJackie", faceDown: true },
      { id: nid("leg"), ref: "legendJudy", faceDown: true },
    ],
    eddies: [],
    trash: [],
    deckCount: 42,
    selectedAttackerId: null,
    rivalAttackerId: null,
    pendingPlay: null,
    pendingKind: null,
    flash: null,
  };
}

export function takeFixer(state: MatchState, dieName: string, face: number): MatchState {
  const fixer = [...state.fixer];
  const idx = fixer.indexOf(dieName);
  if (idx >= 0) fixer.splice(idx, 1);
  else fixer.shift();
  return { ...state, fixer, yourGigs: [...state.yourGigs, face], flash: `gig-${face}` };
}

/** Pioche : la carte quitte le Deck et arrive en main. */
export function draw(state: MatchState, ref: CardRef): MatchState {
  return { ...state, hand: [...state.hand, ref], deckCount: state.deckCount - 1 };
}

export function removeHand(state: MatchState, ref: CardRef): MatchState {
  const i = state.hand.indexOf(ref);
  if (i < 0) return state;
  const hand = [...state.hand];
  hand.splice(i, 1);
  return { ...state, hand };
}

export function spendOneEddie(state: MatchState): MatchState {
  const eddies = state.eddies.map((e) => ({ ...e }));
  const target = eddies.find((e) => !e.spent);
  if (target) target.spent = true;
  return { ...state, eddies, flash: "pay-eddie" };
}

export function spendOneLegend(state: MatchState): MatchState {
  const legends = state.legends.map((l) => ({ ...l }));
  const target = legends.find((l) => !l.spent);
  if (target) target.spent = true;
  return { ...state, legends, flash: "pay-legend" };
}

export function flipOneLegend(state: MatchState): MatchState {
  const legends = state.legends.map((l) => ({ ...l }));
  const target = legends.find((l) => l.faceDown);
  if (target) target.faceDown = false;
  return { ...state, legends, flash: "call-legend" };
}

export function beginPlay(state: MatchState, ref: CardRef, kind: "unit" | "gear"): MatchState {
  const next = removeHand(state, ref);
  return { ...next, pendingPlay: ref, pendingKind: kind, flash: `pending-${ref}` };
}

export function finishPendingUnit(state: MatchState): MatchState {
  const ref = state.pendingPlay;
  if (!ref) return state;
  return {
    ...state,
    pendingPlay: null,
    pendingKind: null,
    field: [...state.field, { id: nid("you"), ref }],
    flash: `play-${ref}`,
  };
}

/** Le Gear de la démo s'équipe sur Meredith (Blocker) : 5 + 3 = 8 de Power pour gagner son blocage. */
const GEAR_HOST: CardRef = "unitBlocker";

export function finishPendingGear(state: MatchState): MatchState {
  const gear = state.pendingPlay;
  if (!gear) return state;
  return {
    ...state,
    pendingPlay: null,
    pendingKind: null,
    field: state.field.map((c) => (c.ref === GEAR_HOST ? { ...c, equipped: gear } : c)),
    flash: "equip",
  };
}

/** Start Phase : tes cartes spent se redressent, puis pioche et Gig. */
export function readyYourCards(state: MatchState): MatchState {
  return {
    ...state,
    field: state.field.map((c) => ({ ...c, spent: false })),
    legends: state.legends.map((c) => ({ ...c, spent: false })),
    eddies: state.eddies.map((c) => ({ ...c, spent: false })),
  };
}

/** Le Rival déclare une attaque sur ta zone Gig avec une Unit ready : elle est spent. */
export function rivalAttack(state: MatchState, ref: CardRef, flash: string): MatchState {
  const attacker = state.rivalField.find((c) => c.ref === ref && !c.spent);
  if (!attacker) return state;
  return {
    ...state,
    rivalAttackerId: attacker.id,
    rivalField: state.rivalField.map((c) => (c.id === attacker.id ? { ...c, spent: true } : c)),
    flash,
  };
}
