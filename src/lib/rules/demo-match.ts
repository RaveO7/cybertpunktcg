import { EXAMPLE_CARDS, type ExampleCard } from "@/lib/rules/examples";
import type { Locale } from "@/lib/i18n/messages";

export type DemoLocale = "fr" | "en";
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

const HAND_START: CardRef[] = [
  "eddieFace",
  "unitAdrenaline",
  "programDetonate",
  "gearConverter",
  "unitBlocker",
  "unitJackie",
];

let idSeq = 0;
function nid(prefix: string) {
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

function takeFixer(state: MatchState, dieName: string, face: number): MatchState {
  const fixer = [...state.fixer];
  const idx = fixer.indexOf(dieName);
  if (idx >= 0) fixer.splice(idx, 1);
  else fixer.shift();
  return { ...state, fixer, yourGigs: [...state.yourGigs, face], flash: `gig-${face}` };
}

/** Pioche : la carte quitte le Deck et arrive en main. */
function draw(state: MatchState, ref: CardRef): MatchState {
  return { ...state, hand: [...state.hand, ref], deckCount: state.deckCount - 1 };
}

function removeHand(state: MatchState, ref: CardRef): MatchState {
  const i = state.hand.indexOf(ref);
  if (i < 0) return state;
  const hand = [...state.hand];
  hand.splice(i, 1);
  return { ...state, hand };
}

function spendOneEddie(state: MatchState): MatchState {
  const eddies = state.eddies.map((e) => ({ ...e }));
  const target = eddies.find((e) => !e.spent);
  if (target) target.spent = true;
  return { ...state, eddies, flash: "pay-eddie" };
}

function spendOneLegend(state: MatchState): MatchState {
  const legends = state.legends.map((l) => ({ ...l }));
  const target = legends.find((l) => !l.spent);
  if (target) target.spent = true;
  return { ...state, legends, flash: "pay-legend" };
}

function flipOneLegend(state: MatchState): MatchState {
  const legends = state.legends.map((l) => ({ ...l }));
  const target = legends.find((l) => l.faceDown);
  if (target) target.faceDown = false;
  return { ...state, legends, flash: "call-legend" };
}

function beginPlay(state: MatchState, ref: CardRef, kind: "unit" | "gear"): MatchState {
  const next = removeHand(state, ref);
  return { ...next, pendingPlay: ref, pendingKind: kind, flash: `pending-${ref}` };
}

function finishPendingUnit(state: MatchState): MatchState {
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

function finishPendingGear(state: MatchState): MatchState {
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
function readyYourCards(state: MatchState): MatchState {
  return {
    ...state,
    field: state.field.map((c) => ({ ...c, spent: false })),
    legends: state.legends.map((c) => ({ ...c, spent: false })),
    eddies: state.eddies.map((c) => ({ ...c, spent: false })),
  };
}

/** Le Rival déclare une attaque sur ta zone Gig avec une Unit ready : elle est spent. */
function rivalAttack(state: MatchState, ref: CardRef, flash: string): MatchState {
  const attacker = state.rivalField.find((c) => c.ref === ref && !c.spent);
  if (!attacker) return state;
  return {
    ...state,
    rivalAttackerId: attacker.id,
    rivalField: state.rivalField.map((c) => (c.id === attacker.id ? { ...c, spent: true } : c)),
    flash,
  };
}

export function buildInteractiveSteps(locale: DemoLocale): InteractiveStep[] {
  const fr = locale === "fr";
  const t = (titleFr: string, titleEn: string, explainFr: string, explainEn: string) => ({
    title: fr ? titleFr : titleEn,
    explain: fr ? explainFr : explainEn,
  });

  return [
    {
      id: "begin",
      tip: fr
        ? "Tu joues en second. Clique pour lancer la partie."
        : "You go second. Click to start the match.",
      ...t(
        "Bienvenue à la table",
        "Welcome to the table",
        "Tu joues en second. Objectif : 7 Gigs au début de ton tour. Survole les cartes (appui long sur mobile) pour lire leur texte. Ensuite on verra les types de cartes et les zones.",
        "You go second. Goal: 7 Gigs at the start of your turn. Hover cards (long-press on mobile) to read their text. Next we’ll cover card types and zones.",
      ),
      anchor: "coach-begin",
      expect: { kind: "begin" },
      apply: (s) => ({ ...s, phase: "you", turn: 1, flash: "begin" }),
    },
    {
      id: "intro-types",
      tip: fr ? "Suivant : types de cartes." : "Next: card types.",
      ...t(
        "4 types de cartes",
        "4 card types",
        "Unit = crew sur le Field (attaque). Program = effet ponctuel (souvent jeté après). Gear = s’équipe sur une Unit/Legend. Legend = 3 personnages du deck (zone à gauche). Eddies = monnaie créée en vendant.",
        "Unit = crew on the Field (attacks). Program = one-shot effect (often trashed after). Gear = equips a Unit/Legend. Legend = 3 deck characters (left zone). Eddies = money made by selling.",
      ),
      anchor: "coach-hand-zone",
      expect: { kind: "continue" },
      apply: (s) => ({ ...s, flash: "intro-types" }),
    },
    {
      id: "intro-legends",
      tip: fr ? "Regarde la zone Legends." : "Look at the Legends zone.",
      ...t(
        "Tes 3 Legends",
        "Your 3 Legends",
        "Elles commencent face cachée. 1×/tour tu peux « Call a Legend » (1 €$) pour en retourner une au hasard. Face visible ou non, une Legend peut aussi payer 1 €$ (comme un Eddie).",
        "They start face-down. Once per turn you can Call a Legend (1 €$) to flip one at random. Face-up or down, a Legend can also pay 1 €$ (like an Eddie).",
      ),
      anchor: "coach-legends",
      expect: { kind: "continue" },
      apply: (s) => ({ ...s, flash: "intro-legends" }),
    },
    {
      id: "t1-die",
      tip: fr ? "Clique le d6 du Fixer." : "Click the Fixer d6.",
      ...t(
        "Gagner un Gig",
        "Gain a Gig",
        "Chaque tour : Ready → pioche → Gig. Prends un dé du Fixer (d20 toujours en dernier), lance-le, mets-le en zone Gig. 1 dé = 1 Gig. La face = Street Cred.",
        "Each turn: Ready → draw → Gig. Take a Fixer die (d20 always last), roll it, put it in your Gig area. 1 die = 1 Gig. The face = Street Cred.",
      ),
      anchor: "coach-die-d6",
      expect: { kind: "die", die: "d6" },
      apply: (s) => takeFixer(draw(s, "unitSmasher"), "d6", 6),
    },
    {
      id: "t1-sell",
      tip: fr ? "Clique Afterparty pour la vendre." : "Click Afterparty to sell it.",
      ...t(
        "Vendre → 1 Eddie",
        "Sell → 1 Eddie",
        "1×/tour : vends une carte avec sell tag. Elle va face cachée en zone Eddies et vaut toujours 1 €$ (pas son coût imprimé).",
        "Once per turn: sell a card with the sell tag. It goes face-down to Eddies and is always worth 1 €$ (not its printed cost).",
      ),
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
      tip: fr ? "Clique Meredith pour la jouer." : "Click Meredith to play her.",
      ...t(
        "Jouer une Unit (coût 4)",
        "Play a Unit (cost 4)",
        "Le coût est en haut à gauche : Meredith Stout coûte 4 €$. Choisis-la en main, puis paie 4 €$ : ton Eddie, puis tes 3 Legends (1 €$ chacune).",
        "The cost is top-left: Meredith Stout costs 4 €$. Pick her from hand, then pay 4 €$: your Eddie, then your 3 Legends (1 €$ each).",
      ),
      anchor: "coach-hand-unitBlocker",
      expect: { kind: "hand", card: "unitBlocker" },
      apply: (s) => beginPlay(s, "unitBlocker", "unit"),
    },
    {
      id: "t1-pay-eddie",
      tip: fr ? "Clique ton Eddie pour payer 1 €$." : "Click your Eddie to pay 1 €$.",
      ...t(
        "Payer avec un Eddie",
        "Pay with an Eddie",
        "Chaque Eddie face cachée vaut 1 €$. Clique-le pour le spend (il se couche). Il se ready au début de ton prochain tour.",
        "Each face-down Eddie is worth 1 €$. Click it to spend (it turns). It readies at the start of your next turn.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t1-pay-legend-1",
      tip: fr ? "Clique une Legend (encore 3 €$)." : "Click a Legend (3 €$ left).",
      ...t(
        "Compléter avec les Legends",
        "Finish with Legends",
        "Il reste 3 €$. Les Legends paient aussi 1 €$ chacune quand tu les spend. Clique une Legend.",
        "3 €$ left. Legends also pay 1 €$ each when spent. Click a Legend.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t1-pay-legend-2",
      tip: fr ? "Encore une Legend (encore 2 €$)." : "Another Legend (2 €$ left).",
      ...t(
        "Deuxième Legend",
        "Second Legend",
        "Encore 1 €$ payé. Il restera 1 €$ : ta dernière Legend.",
        "Another 1 €$ paid. 1 €$ will remain: your last Legend.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t1-pay-legend-3",
      tip: fr ? "Dernière Legend — Meredith arrive." : "Last Legend — Meredith enters.",
      ...t(
        "Dernier €$ → Unit en jeu",
        "Last €$ → Unit enters",
        "Meredith arrive ready sur ton Field, mais avec Lag : sans Adrenaline, une Unit n’attaque pas le tour où elle est jouée. Elle a Blocker : elle pourra protéger tes Gigs pendant le tour du Rival.",
        "Meredith enters your Field ready, but with Lag: without Adrenaline, a Unit can’t attack the turn it’s played. She has Blocker: she can protect your Gigs during the Rival’s turn.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t1-end",
      tip: fr ? "Fin du tour." : "End turn.",
      ...t(
        "Passer la main",
        "Pass the turn",
        "Tout ton €$ est dépensé et Meredith a Lag : rien d’autre à faire. Termine ton tour : le Rival joue alors sa Start Phase puis sa Main Phase.",
        "All your €$ is spent and Meredith has Lag: nothing else to do. End your turn: the Rival then takes their Start and Main phases.",
      ),
      anchor: "coach-end-turn",
      expect: { kind: "end-turn" },
      apply: (s) => ({ ...s, phase: "rival", flash: "end-turn" }),
    },
    {
      id: "r1-ready",
      tip: fr ? "Suivant : Start Phase du Rival." : "Next: Rival Start Phase.",
      ...t(
        "Start Phase (Rival)",
        "Rival Start Phase",
        "Comme toi, le Rival ready ses cartes spent (sa Meredith se redresse), pioche une carte, puis prend un dé au Fixer pour un Gig.",
        "Like you, the Rival readies spent cards (their Meredith stands up), draws a card, then takes a Fixer die for a Gig.",
      ),
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
      tip: fr ? "Suivant : Gig adverse." : "Next: Rival Gig.",
      ...t(
        "Gig pour le Rival",
        "Rival gains a Gig",
        "Il lance un d8 au Fixer et place un 8 dans sa zone Gig. Chaque Gig compte pour gagner la partie.",
        "They roll a d8 from the Fixer and place an 8 in their Gig area. Each Gig counts toward winning.",
      ),
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
      tip: fr ? "Suivant : le Rival joue une Unit." : "Next: Rival plays a Unit.",
      ...t(
        "Main Phase — Jackie",
        "Main Phase — Jackie",
        "Le Rival paie le coût et joue Jackie Welles (Power 8) sur son Field. Elle arrive ready mais avec Lag : elle ne peut pas attaquer ce tour-ci.",
        "The Rival pays the cost and plays Jackie Welles (Power 8) onto their Field. She enters ready but with Lag: she can’t attack this turn.",
      ),
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
      tip: fr ? "Suivant : déclaration d’attaque." : "Next: declare attack.",
      ...t(
        "Meredith adverse attaque",
        "Rival Meredith attacks",
        "Le Rival spend sa Meredith (Power 5), en jeu depuis le début de son tour, et vise ta zone Gig. Ta Meredith pourrait bloquer, mais 5 contre 5 = égalité : les deux iraient à la Trash. Tu laisses passer.",
        "The Rival spends their Meredith (Power 5), in play since the start of their turn, and targets your Gig area. Your Meredith could block, but 5 vs 5 is a tie: both would go to Trash. You let it through.",
      ),
      anchor: "coach-rival-field",
      expect: { kind: "continue" },
      apply: (s) => rivalAttack(s, "unitBlocker", "rival-attack"),
    },
    {
      id: "r1-steal",
      tip: fr ? "Suivant : vol de Gig." : "Next: Gig stolen.",
      ...t(
        "Tu perds un Gig",
        "You lose a Gig",
        "Attaque réussie sur les Gigs : un dé part de ta zone vers celle du Rival (Power 5 → 1 Gig volé).",
        "Successful Gig attack: one die moves from your area to the Rival’s (Power 5 → 1 Gig stolen).",
      ),
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
      tip: fr ? "Clique le d8." : "Click the d8.",
      ...t(
        "Start Phase (Tour 2)",
        "Start Phase (Turn 2)",
        "Ready (cartes remises droites) + pioche + nouveau Gig. Clique le d8 : le d20 reste toujours pour la fin.",
        "Ready (cards upright) + draw + new Gig. Click the d8: the d20 is always last.",
      ),
      anchor: "coach-die-d8",
      expect: { kind: "die", die: "d8" },
      apply: (s) => takeFixer(draw(readyYourCards(s), "programReaper"), "d8", 8),
    },
    {
      id: "t2-sell",
      tip: fr ? "Vends Detonate (un Program)." : "Sell Detonate (a Program).",
      ...t(
        "Program → Eddie",
        "Program → Eddie",
        "Detonate est un Program : en vrai tu peux aussi le jouer pour son effet (puis Trash). Ici on le vend pour 1 Eddie — tu auras 2 Eddies pour payer le Gear.",
        "Detonate is a Program: in a real game you can also play it for its effect (then Trash). Here we sell it for 1 Eddie — you’ll have 2 Eddies to pay for Gear.",
      ),
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
      tip: fr ? "Joue le Gear (coût 2)." : "Play the Gear (cost 2).",
      ...t(
        "Équiper un Gear",
        "Equip Gear",
        "Adrenaline Converter coûte 2 €$ et donne +3 Power à l’Unit qui le porte. Clique le Gear, puis paie avec tes 2 Eddies.",
        "Adrenaline Converter costs 2 €$ and gives +3 Power to the Unit carrying it. Click the Gear, then pay with your 2 Eddies.",
      ),
      anchor: "coach-hand-gearConverter",
      expect: { kind: "hand", card: "gearConverter" },
      apply: (s) => beginPlay(s, "gearConverter", "gear"),
    },
    {
      id: "t2-gear-pay-1",
      tip: fr ? "Spend un Eddie (1/2)." : "Spend an Eddie (1/2).",
      ...t(
        "Eddies d’abord",
        "Eddies first",
        "On spend en général les Eddies avant les Legends. Clique un Eddie ready.",
        "Usually spend Eddies before Legends. Click a ready Eddie.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t2-gear-pay-2",
      tip: fr ? "Spend le 2ᵉ Eddie — équipement." : "Spend the 2nd Eddie — equip.",
      ...t(
        "Gear sur Meredith",
        "Gear on Meredith",
        "Le Gear s’attache à Meredith : Power 5 + 3 = 8. Il la suit si elle change de zone.",
        "The Gear attaches to Meredith: Power 5 + 3 = 8. It follows her if she moves zones.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => finishPendingGear(spendOneEddie(s)),
    },
    {
      id: "t2-call-pay",
      tip: fr ? "Call a Legend : spend 1 Legend." : "Call a Legend: spend 1 Legend.",
      ...t(
        "Call a Legend (1×/tour)",
        "Call a Legend (once/turn)",
        "Tes Eddies sont spent mais tes 3 Legends sont ready. Spend-en une (1 €$) pour Call a Legend : retourner une Legend face visible, sans regarder avant.",
        "Your Eddies are spent but your 3 Legends are ready. Spend one (1 €$) to Call a Legend: flip a Legend face-up without peeking.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t2-call-flip",
      tip: fr ? "Clique une Legend face cachée." : "Click a face-down Legend.",
      ...t(
        "Retourner une Legend",
        "Flip a Legend",
        "La Legend se révèle. Ses effets {Call} se résolvent. Elle reste aussi utilisable comme 1 €$ plus tard.",
        "The Legend flips face-up. Resolve its {Call} effects. It can still pay 1 €$ later.",
      ),
      anchor: "coach-legend-call",
      expect: { kind: "call-legend" },
      apply: (s) => flipOneLegend(s),
    },
    {
      id: "t2-end",
      tip: fr ? "Fin du tour." : "End turn.",
      ...t(
        "Fin du Tour 2",
        "End of Turn 2",
        "Meredith pourrait attaquer, mais elle resterait spent pendant le tour du Rival. Garde-la ready : avec Blocker et 8 de Power, elle protège tes Gigs.",
        "Meredith could attack, but she’d stay spent during the Rival’s turn. Keep her ready: with Blocker and 8 Power, she protects your Gigs.",
      ),
      anchor: "coach-end-turn",
      expect: { kind: "end-turn" },
      apply: (s) => ({ ...s, phase: "rival", rivalAttackerId: null, flash: "end-turn" }),
    },
    {
      id: "r2-ready",
      tip: fr ? "Suivant : tour Rival." : "Next: Rival turn.",
      ...t(
        "Start Phase (Rival)",
        "Rival Start Phase",
        "Nouveau tour adverse : sa Meredith redevient ready. Jackie, restée ready, ne pouvait pas être attaquée.",
        "New Rival turn: their Meredith readies again. Jackie stayed ready, so she couldn’t be attacked.",
      ),
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
      tip: fr ? "Suivant : Gig adverse." : "Next: Rival Gig.",
      ...t(
        "Gig pour le Rival",
        "Rival gains a Gig",
        "Il pioche puis lance un d4 au Fixer : un 4 rejoint sa zone Gig.",
        "They draw, then roll a d4 from the Fixer: a 4 joins their Gig area.",
      ),
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
      tip: fr ? "Suivant : attaque sur tes Gigs." : "Next: attack on your Gigs.",
      ...t(
        "Attaque sur tes Gigs",
        "Attack on your Gigs",
        "La Meredith adverse (Power 5) spend et vise ta zone Gig. Tu peux réagir avec un Blocker ready — ta Meredith !",
        "Rival Meredith (Power 5) spends and targets your Gig area. You can react with a ready Blocker — your Meredith!",
      ),
      anchor: "coach-your-gigs",
      expect: { kind: "continue" },
      apply: (s) => rivalAttack(s, "unitBlocker", "rival-attack-gigs"),
    },
    {
      id: "r2-block",
      tip: fr ? "Clique Meredith pour bloquer." : "Click Meredith to block.",
      ...t(
        "Réaction Blocker",
        "Blocker reaction",
        "Spend Meredith pour rediriger l’attaque sur elle. Combat : 8 (5 + Gear) contre 5, la Meredith du Rival part à la Trash. Aucun Gig n’est volé — c’est ta défense clé.",
        "Spend Meredith to redirect the attack onto her. Fight: 8 (5 + Gear) vs 5, the Rival’s Meredith goes to Trash. No Gig is stolen — this is your key defense.",
      ),
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
      tip: fr ? "Clique le d10." : "Click the d10.",
      ...t(
        "Tour 3 — nouveau Gig",
        "Turn 3 — new Gig",
        "Ready → pioche → Gig. Meredith, tes Eddies et tes Legends sont ready à nouveau.",
        "Ready → draw → Gig. Meredith, your Eddies and your Legends are ready again.",
      ),
      anchor: "coach-die-d10",
      expect: { kind: "die", die: "d10" },
      apply: (s) => takeFixer(draw(readyYourCards(s), "eddieFace"), "d10", 10),
    },
    {
      id: "t3-play",
      tip: fr ? "Joue Riding Nomad (coût 5)." : "Play Riding Nomad (cost 5).",
      ...t(
        "Une Unit Adrenaline",
        "An Adrenaline Unit",
        "Riding Nomad coûte 5 €$ : tes 2 Eddies + tes 3 Legends. Il a Adrenaline : il pourra attaquer dès ce tour. Clique Nomad.",
        "Riding Nomad costs 5 €$: your 2 Eddies + your 3 Legends. It has Adrenaline: it can attack this very turn. Click Nomad.",
      ),
      anchor: "coach-hand-unitAdrenaline",
      expect: { kind: "hand", card: "unitAdrenaline" },
      apply: (s) => beginPlay(s, "unitAdrenaline", "unit"),
    },
    {
      id: "t3-pay-eddie-1",
      tip: fr ? "Spend un Eddie (1/5)." : "Spend an Eddie (1/5).",
      ...t("Payer Nomad", "Pay for Nomad", "Clique un Eddie ready.", "Click a ready Eddie."),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t3-pay-eddie-2",
      tip: fr ? "Spend le 2ᵉ Eddie (2/5)." : "Spend the 2nd Eddie (2/5).",
      ...t(
        "Deuxième Eddie",
        "Second Eddie",
        "Ton 2ᵉ Eddie paie encore 1 €$. Il reste 3 €$ à payer avec tes Legends.",
        "Your 2nd Eddie pays another 1 €$. 3 €$ left to pay with your Legends.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t3-pay-legend-1",
      tip: fr ? "Clique une Legend (3/5)." : "Click a Legend (3/5).",
      ...t(
        "Puis les Legends",
        "Then Legends",
        "Face visible ou non, chaque Legend paie 1 €$. Clique une Legend.",
        "Face-up or down, each Legend pays 1 €$. Click a Legend.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t3-pay-legend-2",
      tip: fr ? "Encore une Legend (4/5)." : "Another Legend (4/5).",
      ...t(
        "Plus qu’1 €$",
        "1 €$ to go",
        "Encore 1 €$ payé. Une dernière Legend et Nomad arrive.",
        "Another 1 €$ paid. One last Legend and Nomad enters.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t3-pay-legend-3",
      tip: fr ? "Dernière Legend — Nomad arrive." : "Last Legend — Nomad enters.",
      ...t(
        "Nomad en jeu",
        "Nomad enters",
        "Paiement OK. Grâce à Adrenaline, Nomad ignore le Lag : il peut attaquer tout de suite.",
        "Paid. Thanks to Adrenaline, Nomad ignores Lag: it can attack right away.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t3-atk-select",
      tip: fr ? "Clique Nomad pour attaquer." : "Click Nomad to attack.",
      ...t(
        "Déclarer l’attaquant",
        "Declare the attacker",
        "Pour attaquer, spend une Unit ready (tourne-la). Cible : une Unit adverse spent, ou la zone Gig adverse. Jackie est ready, donc pas attaquable : vise les Gigs.",
        "To attack, spend a ready Unit (turn it). Target: a spent rival Unit, or the rival Gig area. Jackie is ready, so she can’t be attacked: go for the Gigs.",
      ),
      anchor: "coach-field-unitAdrenaline",
      expect: { kind: "field", ref: "unitAdrenaline" },
      apply: (s) => {
        const nomad = s.field.find((c) => c.ref === "unitAdrenaline" && !c.spent);
        return { ...s, selectedAttackerId: nomad?.id ?? null, flash: "select" };
      },
    },
    {
      id: "t3-atk-target",
      tip: fr ? "Clique les Gigs du Rival." : "Click Rival Gigs.",
      ...t(
        "Voler un Gig",
        "Steal a Gig",
        "Attaquer la zone Gig vole des dés : Power 1+ → 1 Gig, 10+ → 2, 20+ → 3. Nomad (P4) vole 1 Gig. Une vraie partie continue jusqu’à 7 Gigs au début de ton tour.",
        "Attacking the Gig area steals dice: Power 1+ → 1 Gig, 10+ → 2, 20+ → 3. Nomad (P4) steals 1 Gig. A real game continues until 7 Gigs at the start of your turn.",
      ),
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
      tip: fr ? "Démo terminée." : "Demo complete.",
      ...t(
        "Tu as les bases",
        "You’ve got the basics",
        "Tu as vu : types (Unit/Program/Gear/Legend), Eddies, coûts, Lag et Adrenaline, Call a Legend, attaque, Blocker, combat, Gear. Pour RAM, construction de deck et tous les keywords → Règles détaillées.",
        "You’ve seen: types (Unit/Program/Gear/Legend), Eddies, costs, Lag and Adrenaline, Call a Legend, attack, Blocker, fights, Gear. For RAM, deckbuilding and all keywords → Detailed rules.",
      ),
      anchor: "coach-done",
      expect: { kind: "done" },
      apply: (s) => s,
    },
  ];
}

export function demoTableCopy(locale: Locale | DemoLocale) {
  const fr = locale === "fr";
  return {
    eyebrow: fr ? "DUEL DÉMO" : "DEMO DUEL",
    title: fr ? "Ta première partie" : "Your first match",
    subtitle: fr
      ? "Survole une carte (appui long sur mobile) pour zoomer. Clique les éléments qui pulsent — comme en ligne."
      : "Hover a card (long-press on mobile) to zoom. Click pulsing targets — like an online client.",
    tipLabel: fr ? "Coach" : "Coach",
    yourHand: fr ? "Main" : "Hand",
    endTurn: fr ? "Fin du tour" : "End turn",
    begin: fr ? "Lancer la partie" : "Start match",
    next: fr ? "Suivant" : "Next",
    rivalPhase: fr ? "Tour du Rival" : "Rival’s turn",
    restart: fr ? "Rejouer" : "Replay",
    openRules: fr ? "Règles détaillées" : "Detailed rules",
    exit: fr ? "Quitter le tutoriel" : "Exit tutorial",
    fixer: "Fixer",
    yourGigs: fr ? "Tes Gigs" : "Your Gigs",
    rivalGigs: fr ? "Gigs Rival" : "Rival Gigs",
    legends: "Legends",
    eddies: "Eddies",
    yourField: fr ? "Ton Field" : "Your Field",
    rivalField: fr ? "Field Rival" : "Rival Field",
    deck: "Deck",
    trash: "Trash",
    spent: "spent",
    paying: fr ? "À payer" : "Paying",
    wrong: fr ? "Pas maintenant — suis l’élément qui pulse." : "Not now — follow the pulsing target.",
    fx: {
      begin: fr ? "À toi de jouer" : "Your move",
      gig: fr ? "Gig gagné" : "Gig gained",
      streetCred: (face: string) => `Street Cred ${face}`,
      sell: "+1 €$",
      legend: fr ? "Legend révélée" : "Legend revealed",
      deployed: fr ? "Déployé" : "Deployed",
      equip: fr ? "Gear équipé" : "Gear equipped",
      steal: fr ? "Gig volé !" : "Gig stolen!",
      fight: fr ? "Combat !" : "Fight!",
      rivalTurn: fr ? "Tour du Rival" : "Rival’s turn",
      rivalPlay: fr ? "Le Rival joue" : "Rival plays",
      attack: fr ? "Attaque !" : "Attack!",
      lost: fr ? "Gig perdu" : "Gig lost",
      block: fr ? "Bloqué !" : "Blocked!",
      win: fr ? "Fin de la démo" : "Demo complete",
      winSub: fr ? "3 Gigs — il en faut 7 au début de ton tour pour gagner" : "3 Gigs — you need 7 at the start of your turn to win",
    },
    turnYou: (n: number) => (fr ? `Tour ${n}` : `Turn ${n}`),
    turnRival: (n: number) => (fr ? `Rival · Tour ${n}` : `Rival · Turn ${n}`),
  };
}

export function cardOf(ref: CardRef): ExampleCard {
  return EXAMPLE_CARDS[ref];
}

export function matchesExpect(
  expect: ExpectAction,
  action:
    | { type: "begin" }
    | { type: "die"; die: string }
    | { type: "hand"; card: CardRef }
    | { type: "field"; ref: CardRef; id: string }
    | { type: "target-gigs" }
    | { type: "target-rival"; ref: CardRef }
    | { type: "end-turn" }
    | { type: "continue" }
    | { type: "eddie" }
    | { type: "legend" }
    | { type: "call-legend" }
    | { type: "done" },
): boolean {
  switch (expect.kind) {
    case "begin":
      return action.type === "begin";
    case "die":
      return action.type === "die" && action.die === expect.die;
    case "hand":
      return action.type === "hand" && action.card === expect.card;
    case "field":
      return action.type === "field" && action.ref === expect.ref;
    case "target-gigs":
      return action.type === "target-gigs";
    case "target-rival":
      return action.type === "target-rival" && (expect.ref == null || action.ref === expect.ref);
    case "end-turn":
      return action.type === "end-turn";
    case "continue":
      return action.type === "continue";
    case "eddie":
      return action.type === "eddie";
    case "legend":
      return action.type === "legend";
    case "call-legend":
      return action.type === "call-legend";
    case "done":
      return action.type === "done";
    default:
      return false;
  }
}
