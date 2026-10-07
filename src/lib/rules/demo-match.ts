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

function finishPendingGear(state: MatchState): MatchState {
  return {
    ...state,
    pendingPlay: null,
    pendingKind: null,
    field: state.field.map((c) =>
      c.ref === "unitAdrenaline" ? { ...c, equipped: "gearConverter" } : c,
    ),
    flash: "equip",
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
      apply: (s) => takeFixer({ ...s, deckCount: s.deckCount - 1 }, "d6", 6),
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
      tip: fr ? "Clique Riding Nomad pour le jouer." : "Click Riding Nomad to play it.",
      ...t(
        "Jouer une Unit (coût 3)",
        "Play a Unit (cost 3)",
        "Tu choisis la carte en main. Ensuite tu paies 3 €$ en cliquant tes Eddies puis tes Legends (1 €$ chacune).",
        "Pick the card from hand. Then pay 3 €$ by clicking your Eddies, then Legends (1 €$ each).",
      ),
      anchor: "coach-hand-unitAdrenaline",
      expect: { kind: "hand", card: "unitAdrenaline" },
      apply: (s) => beginPlay(s, "unitAdrenaline", "unit"),
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
      tip: fr ? "Clique une Legend (encore 2 €$)." : "Click a Legend (2 €$ left).",
      ...t(
        "Compléter avec les Legends",
        "Finish with Legends",
        "Il reste 2 €$. Les Legends paient aussi 1 €$ chacune quand tu les spend. Clique une Legend.",
        "2 €$ left. Legends also pay 1 €$ each when spent. Click a Legend.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t1-pay-legend-2",
      tip: fr ? "Encore une Legend — Nomad arrive." : "One more Legend — Nomad enters.",
      ...t(
        "Dernier €$ → Unit en jeu",
        "Last €$ → Unit enters",
        "Dernier paiement : Nomad arrive sur ton Field. Il a Adrenaline, donc il peut attaquer tout de suite.",
        "Final payment: Nomad enters your Field. It has Adrenaline, so it can attack immediately.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t1-attack-select",
      tip: fr ? "Clique Nomad pour attaquer." : "Click Nomad to attack.",
      ...t(
        "Déclarer l’attaquant",
        "Declare the attacker",
        "Pour attaquer, spend une Unit ready (tourne-la). Ensuite tu choisis la cible : Unit adverse spent, ou zone Gig adverse.",
        "To attack, spend a ready Unit (turn it). Then choose a target: a spent rival Unit, or the rival Gig area.",
      ),
      anchor: "coach-field-unitAdrenaline",
      expect: { kind: "field", ref: "unitAdrenaline" },
      apply: (s) => {
        const nomad = s.field.find((c) => c.ref === "unitAdrenaline" && !c.spent);
        return { ...s, selectedAttackerId: nomad?.id ?? null, flash: "select" };
      },
    },
    {
      id: "t1-attack-target",
      tip: fr ? "Clique les Gigs du Rival." : "Click Rival Gigs.",
      ...t(
        "Voler un Gig",
        "Steal a Gig",
        "Attaquer la zone Gig vole des dés. Power 1+ → 1 Gig, 10+ → 2, 20+ → 3. Ici Nomad (P4) vole 1 Gig.",
        "Attacking the Gig area steals dice. Power 1+ → 1 Gig, 10+ → 2, 20+ → 3. Here Nomad (P4) steals 1 Gig.",
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
          field: s.field.map((c) =>
            c.ref === "unitAdrenaline" ? { ...c, spent: true } : c,
          ),
          flash: "steal",
        };
      },
    },
    {
      id: "t1-end",
      tip: fr ? "Fin du tour." : "End turn.",
      ...t(
        "Passer la main",
        "Pass the turn",
        "Quand tu as fini tes actions (vente, jeu, attaques), tu termines. Le Rival joue alors sa Start Phase puis sa Main Phase.",
        "When you’re done (sell, play, attacks), you end. The Rival then takes their Start and Main phases.",
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
        "Comme toi, le Rival ready ses cartes spent, pioche une carte, puis prend un dé au Fixer pour un Gig.",
        "Like you, the Rival readies spent cards, draws a card, then takes a Fixer die for a Gig.",
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
        deckCount: s.deckCount - 1,
        flash: "rival-gig",
      }),
    },
    {
      id: "r1-play",
      tip: fr ? "Suivant : le Rival joue une Unit." : "Next: Rival plays a Unit.",
      ...t(
        "Main Phase — Jackie",
        "Main Phase — Jackie",
        "Le Rival paie le coût et joue Jackie Welles sur son Field. Elle est ready et peut attaquer.",
        "The Rival pays the cost and plays Jackie Welles onto their Field. She’s ready and can attack.",
      ),
      anchor: "coach-rival-field",
      expect: { kind: "continue" },
      apply: (s) => {
        const jackieId = nid("riv");
        return {
          ...s,
          rivalField: [{ id: jackieId, ref: "unitJackie" }, ...s.rivalField],
          flash: "rival-play",
        };
      },
    },
    {
      id: "r1-attack",
      tip: fr ? "Suivant : déclaration d’attaque." : "Next: declare attack.",
      ...t(
        "Jackie attaque",
        "Jackie attacks",
        "Le Rival spend Jackie et cible ta zone Gig. Tu n’as aucun Blocker ready pour intercepter.",
        "The Rival spends Jackie and targets your Gig area. You have no ready Blocker to intercept.",
      ),
      anchor: "coach-rival-unitJackie",
      expect: { kind: "continue" },
      apply: (s) => {
        const jackie = s.rivalField.find((c) => c.ref === "unitJackie" && !c.spent);
        return {
          ...s,
          rivalAttackerId: jackie?.id ?? null,
          flash: "rival-attack",
        };
      },
    },
    {
      id: "r1-steal",
      tip: fr ? "Suivant : vol de Gig." : "Next: Gig stolen.",
      ...t(
        "Tu perds un Gig",
        "You lose a Gig",
        "Attaque réussie sur les Gigs : un dé part de ta zone vers celle du Rival (Power 4 → 1 Gig volé).",
        "Successful Gig attack: one die moves from your area to the Rival’s (Power 4 → 1 Gig stolen).",
      ),
      anchor: "coach-your-gigs",
      expect: { kind: "continue" },
      apply: (s) => {
        const lost = s.yourGigs[s.yourGigs.length - 1];
        return {
          ...s,
          yourGigs: s.yourGigs.slice(0, -1),
          rivalGigs: lost != null ? [...s.rivalGigs, lost] : s.rivalGigs,
          rivalField: s.rivalField.map((c) =>
            c.ref === "unitJackie" ? { ...c, spent: true } : c,
          ),
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
      apply: (s) => {
        const ready: MatchState = {
          ...s,
          field: s.field.map((c) => ({ ...c, spent: false })),
          legends: s.legends.map((c) => ({ ...c, spent: false })),
          eddies: s.eddies.map((c) => ({ ...c, spent: false })),
          deckCount: s.deckCount - 1,
        };
        return takeFixer(ready, "d8", 8);
      },
    },
    {
      id: "t2-sell",
      tip: fr ? "Vends Detonate (un Program)." : "Sell Detonate (a Program).",
      ...t(
        "Program → Eddie",
        "Program → Eddie",
        "Detonate est un Program : en vrai tu peux aussi le jouer pour son effet (puis Trash). Ici on le vend pour 1 Eddie — utile pour payer Meredith.",
        "Detonate is a Program: in a real game you can also play it for its effect (then Trash). Here we sell it for 1 Eddie — needed to pay Meredith.",
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
      id: "t2-play-blocker",
      tip: fr ? "Joue Meredith (3 €$)." : "Play Meredith (3 €$).",
      ...t(
        "Jouer un Blocker",
        "Play a Blocker",
        "Meredith a Blocker. Ici on paie 3 €$ (2 Eddies + 1 Legend) pour garder 2 Legends pour le Gear ensuite. Clique Meredith.",
        "Meredith has Blocker. Here we pay 3 €$ (2 Eddies + 1 Legend) to keep 2 Legends for Gear next. Click Meredith.",
      ),
      anchor: "coach-hand-unitBlocker",
      expect: { kind: "hand", card: "unitBlocker" },
      apply: (s) => beginPlay(s, "unitBlocker", "unit"),
    },
    {
      id: "t2-pay-eddie-1",
      tip: fr ? "Spend un Eddie (1/3)." : "Spend an Eddie (1/3).",
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
      id: "t2-pay-eddie-2",
      tip: fr ? "Spend le 2ᵉ Eddie (2/3)." : "Spend the 2nd Eddie (2/3).",
      ...t(
        "Deuxième Eddie",
        "Second Eddie",
        "Ton 2ᵉ Eddie paie encore 1 €$. Il reste 1 €$ à payer avec une Legend.",
        "Your 2nd Eddie pays another 1 €$. 1 €$ left to pay with a Legend.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t2-pay-legend-1",
      tip: fr ? "Clique une Legend — Meredith arrive." : "Click a Legend — Meredith enters.",
      ...t(
        "Meredith en jeu",
        "Meredith enters",
        "Dernier €$ : clique une Legend. Meredith a Blocker — garde-la ready pour protéger tes Gigs. Il te reste 2 Legends pour le Gear.",
        "Last €$: click a Legend. Meredith has Blocker — keep her ready to protect your Gigs. 2 Legends left for Gear.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t2-gear",
      tip: fr ? "Équipe le Gear (coût 2)." : "Equip the Gear (cost 2).",
      ...t(
        "Équiper un Gear",
        "Equip Gear",
        "Converter coûte 2. Tes Eddies sont spent : tu paieras avec 2 Legends ready. Clique le Gear.",
        "Converter costs 2. Your Eddies are spent: you’ll pay with 2 ready Legends. Click the Gear.",
      ),
      anchor: "coach-hand-gearConverter",
      expect: { kind: "hand", card: "gearConverter" },
      apply: (s) => beginPlay(s, "gearConverter", "gear"),
    },
    {
      id: "t2-gear-pay-1",
      tip: fr ? "Clique une Legend (1/2)." : "Click a Legend (1/2).",
      ...t(
        "Payer le Gear",
        "Pay for Gear",
        "Sans Eddie ready, les Legends couvrent le coût. Clique une Legend qui pulse.",
        "With no ready Eddie, Legends cover the cost. Click a pulsing Legend.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => spendOneLegend(s),
    },
    {
      id: "t2-gear-pay-2",
      tip: fr ? "Clique la dernière Legend — équipement." : "Click the last Legend — equip.",
      ...t(
        "Gear sur Nomad",
        "Gear on Nomad",
        "Clique la Legend qui pulse. Le Gear s’attache à Nomad et le suit s’il change de zone.",
        "Click the pulsing Legend. The Gear attaches to Nomad and follows if it moves zones.",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingGear(spendOneLegend(s)),
    },
    {
      id: "t2-atk-select",
      tip: fr ? "Sélectionne Nomad." : "Select Nomad.",
      ...t(
        "Attaquer une Unit",
        "Attack a Unit",
        "Parfois il vaut mieux nettoyer le Field adverse avant de voler. Sélectionne ton attaquant.",
        "Sometimes clear the rival Field before stealing. Select your attacker.",
      ),
      anchor: "coach-field-unitAdrenaline",
      expect: { kind: "field", ref: "unitAdrenaline" },
      apply: (s) => {
        const nomad = s.field.find((c) => c.ref === "unitAdrenaline" && !c.spent);
        return { ...s, selectedAttackerId: nomad?.id ?? null };
      },
    },
    {
      id: "t2-atk-target",
      tip: fr ? "Clique Jackie adverse." : "Click rival Jackie.",
      ...t(
        "Combat Power vs Power",
        "Fight Power vs Power",
        "Compare la Power. Le plus haut vainc ; égalité = les deux Trash. Jackie adverse part à la Trash.",
        "Compare Power. Higher wins; tie = both to Trash. Rival Jackie goes to Trash.",
      ),
      anchor: "coach-rival-unitJackie",
      expect: { kind: "target-rival", ref: "unitJackie" },
      apply: (s) => ({
        ...s,
        selectedAttackerId: null,
        field: s.field.map((c) =>
          c.ref === "unitAdrenaline" ? { ...c, spent: true } : c,
        ),
        rivalField: s.rivalField.filter((c) => c.ref !== "unitJackie"),
        trash: [...s.trash, "unitJackie"],
        flash: "fight",
      }),
    },
    {
      id: "t2-end",
      tip: fr ? "Fin du tour." : "End turn.",
      ...t(
        "Fin du Tour 2",
        "End of Turn 2",
        "Meredith est ready avec Blocker. Le Rival va attaquer tes Gigs — tu pourras réagir.",
        "Meredith is ready with Blocker. The Rival will attack your Gigs — you can react.",
      ),
      anchor: "coach-end-turn",
      expect: { kind: "end-turn" },
      apply: (s) => ({ ...s, phase: "rival", rivalAttackerId: null }),
    },
    {
      id: "r2-ready",
      tip: fr ? "Suivant : tour Rival." : "Next: Rival turn.",
      ...t(
        "Start Phase (Rival)",
        "Rival Start Phase",
        "Nouveau tour adverse : ses cartes spent redeviennent ready. Il se prépare à attaquer tes Gigs.",
        "New Rival turn: their spent cards ready again. They’re setting up to attack your Gigs.",
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
      id: "r2-play",
      tip: fr ? "Suivant : Unit adverse." : "Next: Rival Unit.",
      ...t(
        "Le Rival joue encore",
        "Rival plays again",
        "Il pose une nouvelle menace : Jackie Welles revient sur son Field, ready.",
        "They deploy another threat: Jackie Welles enters their Field, ready.",
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
      id: "r2-attack",
      tip: fr ? "Suivant : attaque sur tes Gigs." : "Next: attack on your Gigs.",
      ...t(
        "Attaque sur tes Gigs",
        "Attack on your Gigs",
        "Jackie spend et vise ta zone Gig. Tu peux encore réagir avec un Blocker ready — Meredith !",
        "Jackie spends and targets your Gig area. You can still react with a ready Blocker — Meredith!",
      ),
      anchor: "coach-your-gigs",
      expect: { kind: "continue" },
      apply: (s) => {
        const jackie = s.rivalField.find((c) => c.ref === "unitJackie" && !c.spent);
        return {
          ...s,
          rivalAttackerId: jackie?.id ?? null,
          rivalField: s.rivalField.map((c) =>
            c.ref === "unitJackie" ? { ...c, spent: true } : c,
          ),
          flash: "rival-attack-gigs",
        };
      },
    },
    {
      id: "r2-block",
      tip: fr ? "Clique Meredith pour bloquer." : "Click Meredith to block.",
      ...t(
        "Réaction Blocker",
        "Blocker reaction",
        "Spend Meredith pour rediriger l’attaque sur elle. Aucun Gig n’est volé — c’est ta défense clé.",
        "Spend Meredith to redirect the attack onto her. No Gig is stolen — this is your key defense.",
      ),
      anchor: "coach-field-unitBlocker",
      expect: { kind: "field", ref: "unitBlocker" },
      apply: (s) => ({
        ...s,
        field: s.field.map((c) =>
          c.ref === "unitBlocker" ? { ...c, spent: true } : c,
        ),
        rivalAttackerId: null,
        phase: "you",
        turn: 3,
        rivalField: s.rivalField.filter((c) => c.ref !== "unitJackie"),
        trash: [...s.trash, "unitJackie"],
        flash: "block",
      }),
    },
    {
      id: "t3-die",
      tip: fr ? "Clique le d10." : "Click the d10.",
      ...t(
        "Tour 3 — nouveau Gig",
        "Turn 3 — new Gig",
        "Ready → pioche → Gig. Eddies et Legends sont ready à nouveau.",
        "Ready → draw → Gig. Eddies and Legends ready again.",
      ),
      anchor: "coach-die-d10",
      expect: { kind: "die", die: "d10" },
      apply: (s) => {
        const ready: MatchState = {
          ...s,
          field: s.field.map((c) => ({ ...c, spent: false })),
          legends: s.legends.map((c) => ({ ...c, spent: false })),
          eddies: s.eddies.map((c) => ({ ...c, spent: false })),
          deckCount: s.deckCount - 1,
        };
        return takeFixer(ready, "d10", 10);
      },
    },
    {
      id: "t3-call-pay",
      tip: fr ? "Call a Legend : spend 1 Eddie." : "Call a Legend: spend 1 Eddie.",
      ...t(
        "Call a Legend (1×/tour)",
        "Call a Legend (once/turn)",
        "Spend 1 €$ pour retourner une Legend face visible, sans regarder avant. Clique un Eddie pour payer.",
        "Spend 1 €$ to flip a Legend face-up without peeking. Click an Eddie to pay.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t3-call-flip",
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
      id: "t3-play",
      tip: fr ? "Joue Jackie (coût 2)." : "Play Jackie (cost 2).",
      ...t(
        "Renforcer le Field",
        "Reinforce the Field",
        "Il te reste 1 Eddie ready + des Legends. Clique Jackie, puis paie 1 Eddie + 1 Legend.",
        "You still have 1 ready Eddie + Legends. Click Jackie, then pay 1 Eddie + 1 Legend.",
      ),
      anchor: "coach-hand-unitJackie",
      expect: { kind: "hand", card: "unitJackie" },
      apply: (s) => beginPlay(s, "unitJackie", "unit"),
    },
    {
      id: "t3-pay-eddie-1",
      tip: fr ? "Spend l’Eddie restant (1/2)." : "Spend the remaining Eddie (1/2).",
      ...t(
        "Payer Jackie",
        "Pay for Jackie",
        "Clique l’Eddie ready.",
        "Click the ready Eddie.",
      ),
      anchor: "coach-eddie",
      expect: { kind: "eddie" },
      apply: (s) => spendOneEddie(s),
    },
    {
      id: "t3-pay-legend",
      tip: fr ? "Clique une Legend — Jackie arrive." : "Click a Legend — Jackie enters.",
      ...t(
        "Jackie en jeu",
        "Jackie enters",
        "Paiement OK. Jackie arrive ready (Lag : sans Adrenaline elle n’attaque pas ce tour-ci).",
        "Paid. Jackie enters ready (Lag: without Adrenaline she won’t attack this turn).",
      ),
      anchor: "coach-legend",
      expect: { kind: "legend" },
      apply: (s) => finishPendingUnit(spendOneLegend(s)),
    },
    {
      id: "t3-atk-select",
      tip: fr ? "Nomad attaque encore." : "Nomad attacks again.",
      ...t(
        "Encore une attaque",
        "Another attack",
        "Les Units ready peuvent attaquer chaque tour. Clique Nomad pour viser les Gigs.",
        "Ready Units can attack each turn. Click Nomad to aim at the Gigs.",
      ),
      anchor: "coach-field-unitAdrenaline",
      expect: { kind: "field", ref: "unitAdrenaline" },
      apply: (s) => {
        const nomad = s.field.find((c) => c.ref === "unitAdrenaline" && !c.spent);
        return { ...s, selectedAttackerId: nomad?.id ?? null };
      },
    },
    {
      id: "t3-atk-target",
      tip: fr ? "Vole un dernier Gig." : "Steal one last Gig.",
      ...t(
        "Boucle de partie",
        "The game loop",
        "Tu as vu le cycle complet : Eddies → Units/Gear → attaque/défense → Gigs. Une vraie partie continue jusqu’à 7 Gigs en début de tour.",
        "You’ve seen the full loop: Eddies → Units/Gear → attack/defense → Gigs. A real game continues until 7 Gigs at turn start.",
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
          field: s.field.map((c) =>
            c.ref === "unitAdrenaline" ? { ...c, spent: true } : c,
          ),
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
        "Tu as vu : types (Unit/Program/Gear/Legend), Eddies, Call a Legend, attaque, Blocker, Gear. Pour RAM, construction de deck et tous les keywords → Règles détaillées.",
        "You’ve seen: types (Unit/Program/Gear/Legend), Eddies, Call a Legend, attack, Blocker, Gear. For RAM, deckbuilding and all keywords → Detailed rules.",
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
      win: fr ? "Victoire" : "Victory",
      winSub: fr ? "7 Gigs — Night City est à toi" : "7 Gigs — Night City is yours",
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
