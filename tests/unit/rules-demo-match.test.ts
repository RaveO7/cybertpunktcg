import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { LOCALES } from "../../src/lib/i18n/messages";
import {
  buildInteractiveSteps,
  cardOf,
  demoTableCopy,
  initialMatchState,
  matchesExpect,
  type BoardCard,
  type CardRef,
  type ExpectAction,
  type InteractiveStep,
  type MatchState,
} from "../../src/lib/rules/demo-match";
import { EXAMPLE_CARDS } from "../../src/lib/rules/examples";
import { howtoPlayContent } from "../../src/lib/rules/howto-play";

type Transition = { step: InteractiveStep; index: number; before: MatchState; after: MatchState };

/** Joue toute la démo en appliquant chaque étape dans l'ordre (comme DemoMatch quand on suit le coach). */
function runDemo(locale: "fr" | "en" = "fr"): { transitions: Transition[]; final: MatchState } {
  const steps = buildInteractiveSteps(locale);
  let state = initialMatchState();
  const transitions: Transition[] = [];
  steps.forEach((step, index) => {
    const before = state;
    state = step.apply(state);
    transitions.push({ step, index, before, after: state });
  });
  return { transitions, final: state };
}

/** Règle officielle : 1 Gig dès Power 1, +1 par tranche de 10. */
function gigsStolen(power: number): number {
  return power <= 0 ? 0 : 1 + Math.floor(power / 10);
}

/** Power d'une carte en jeu, Gear équipé compris. */
function powerOf(card: BoardCard): number {
  const base = (cardOf(card.ref).power ?? 0) as number;
  const gear = card.equipped ? ((cardOf(card.equipped).power ?? 0) as number) : 0;
  return base + gear;
}

function spentCount(cards: BoardCard[]): number {
  return cards.filter((c) => c.spent).length;
}

/** Action d'interface qui satisfait exactement une attente. */
function actionFor(expect: ExpectAction): Parameters<typeof matchesExpect>[1] {
  switch (expect.kind) {
    case "die":
      return { type: "die", die: expect.die };
    case "hand":
      return { type: "hand", card: expect.card };
    case "field":
      return { type: "field", ref: expect.ref, id: "x" };
    case "target-rival":
      return { type: "target-rival", ref: expect.ref ?? "unitJackie" };
    default:
      return { type: expect.kind } as Parameters<typeof matchesExpect>[1];
  }
}

const keywordExample = (name: string) => {
  const kw = howtoPlayContent("en").keywords.items.find((k) => k.name === name);
  assert.ok(kw?.exampleKey, `mot-clé ${name} sans exemple`);
  return kw.exampleKey;
};

/** Toutes les cartes « à toi » (hors Legends et hors cartes du Rival). */
function yourCardCount(s: MatchState): number {
  return (
    s.hand.length +
    s.field.length +
    s.field.filter((c) => c.equipped).length +
    s.eddies.length +
    (s.pendingPlay ? 1 : 0) +
    s.deckCount
  );
}

const DIE_ORDER = ["d4", "d6", "d8", "d10", "d12", "d20"];

describe("Démo interactive — définition des étapes", () => {
  const fr = buildInteractiveSteps("fr");
  const en = buildInteractiveSteps("en");

  it("ids uniques, première étape « begin », seule la dernière est « done »", () => {
    assert.equal(new Set(fr.map((s) => s.id)).size, fr.length);
    assert.equal(fr[0].expect.kind, "begin");
    assert.equal(fr.filter((s) => s.expect.kind === "begin").length, 1);
    assert.equal(fr[fr.length - 1].expect.kind, "done");
    assert.equal(fr.filter((s) => s.expect.kind === "done").length, 1);
  });

  it("FR et EN : mêmes étapes, mêmes ancres et attentes, textes non vides et traduits", () => {
    assert.equal(fr.length, en.length);
    fr.forEach((s, i) => {
      const e = en[i];
      assert.equal(s.id, e.id);
      assert.equal(s.anchor, e.anchor, s.id);
      assert.deepEqual(s.expect, e.expect, s.id);
      for (const step of [s, e]) {
        assert.ok(step.tip.trim() && step.title.trim() && step.explain.trim(), `${step.id} : texte vide`);
      }
      assert.notEqual(s.explain, e.explain, `${s.id} : explication non traduite`);
      assert.notEqual(s.tip, e.tip, `${s.id} : astuce non traduite`);
    });
  });

  it("l'ancre de chaque étape correspond à son attente", () => {
    for (const s of fr) {
      const { expect, anchor } = s;
      if (expect.kind === "die") assert.equal(anchor, `coach-die-${expect.die}`, s.id);
      if (expect.kind === "hand") assert.equal(anchor, `coach-hand-${expect.card}`, s.id);
      if (expect.kind === "field") assert.equal(anchor, `coach-field-${expect.ref}`, s.id);
      if (expect.kind === "target-rival" && expect.ref) assert.equal(anchor, `coach-rival-${expect.ref}`, s.id);
      if (expect.kind === "target-gigs") assert.equal(anchor, "coach-rival-gigs", s.id);
      if (expect.kind === "begin") assert.equal(anchor, "coach-begin", s.id);
      if (expect.kind === "end-turn") assert.equal(anchor, "coach-end-turn", s.id);
      if (expect.kind === "done") assert.equal(anchor, "coach-done", s.id);
      if (expect.kind === "eddie") assert.equal(anchor, "coach-eddie", s.id);
      if (expect.kind === "legend") assert.equal(anchor, "coach-legend", s.id);
      if (expect.kind === "call-legend") assert.equal(anchor, "coach-legend-call", s.id);
    }
  });

  it("les cartes référencées existent dans EXAMPLE_CARDS", () => {
    for (const s of fr) {
      const e = s.expect;
      const ref = e.kind === "hand" ? e.card : e.kind === "field" || e.kind === "target-rival" ? e.ref : undefined;
      if (ref) assert.ok(ref in EXAMPLE_CARDS, `${s.id} : ${ref}`);
    }
  });
});

describe("Démo interactive — matchesExpect", () => {
  const steps = buildInteractiveSteps("fr");
  const kinds = [
    "begin",
    "die",
    "hand",
    "field",
    "target-gigs",
    "target-rival",
    "end-turn",
    "continue",
    "eddie",
    "legend",
    "call-legend",
    "done",
  ] as const;

  it("l'action attendue est acceptée à chaque étape", () => {
    for (const s of steps) assert.ok(matchesExpect(s.expect, actionFor(s.expect)), s.id);
  });

  it("toute action d'un autre type est refusée", () => {
    for (const s of steps) {
      for (const kind of kinds) {
        if (kind === s.expect.kind) continue;
        const other = actionFor({ kind } as ExpectAction);
        // actionFor sur un type sans paramètre donne déjà une action valide de ce type
        const action =
          kind === "die"
            ? { type: "die" as const, die: "d4" }
            : kind === "hand"
              ? { type: "hand" as const, card: "eddieFace" as CardRef }
              : kind === "field"
                ? { type: "field" as const, ref: "unitJackie" as CardRef, id: "x" }
                : kind === "target-rival"
                  ? { type: "target-rival" as const, ref: "unitJackie" as CardRef }
                  : other;
        assert.equal(matchesExpect(s.expect, action), false, `${s.id} accepte ${kind}`);
      }
    }
  });

  it("le mauvais dé, la mauvaise carte ou la mauvaise cible sont refusés", () => {
    assert.equal(matchesExpect({ kind: "die", die: "d6" }, { type: "die", die: "d8" }), false);
    assert.equal(matchesExpect({ kind: "hand", card: "unitJackie" }, { type: "hand", card: "unitBlocker" }), false);
    assert.equal(
      matchesExpect({ kind: "field", ref: "unitBlocker" }, { type: "field", ref: "unitAdrenaline", id: "a" }),
      false,
    );
    assert.equal(
      matchesExpect({ kind: "target-rival", ref: "unitJackie" }, { type: "target-rival", ref: "unitBlocker" }),
      false,
    );
  });

  it("une cible Rival sans carte précisée accepte n'importe quelle Unit", () => {
    assert.ok(matchesExpect({ kind: "target-rival" }, { type: "target-rival", ref: "unitBlocker" }));
    assert.ok(matchesExpect({ kind: "target-rival" }, { type: "target-rival", ref: "unitJackie" }));
  });
});

describe("Démo interactive — simulation de la partie", () => {
  const { transitions, final } = runDemo("fr");

  it("état initial : 6 dés au Fixer, 3 Legends face cachée, main de départ sans doublon", () => {
    const s = initialMatchState();
    assert.deepEqual(s.fixer, DIE_ORDER);
    assert.equal(s.legends.length, 3);
    assert.ok(s.legends.every((l) => l.faceDown && !l.spent));
    assert.equal(new Set(s.legends.map((l) => l.ref)).size, 3, "3 Legends aux noms uniques");
    assert.ok(s.legends.every((l) => EXAMPLE_CARDS[l.ref].type === "Legend"));
    assert.equal(new Set(s.hand).size, s.hand.length);
    assert.equal(s.phase, "setup");
  });

  it("déterministe : deux parties (et les deux langues) donnent les mêmes états", () => {
    const a = runDemo("fr");
    const b = runDemo("en");
    assert.deepEqual(
      a.transitions.map((t) => t.after),
      b.transitions.map((t) => t.after),
    );
    assert.deepEqual(a.final, runDemo("fr").final);
  });

  it("apply ne mute jamais l'état précédent", () => {
    let state = initialMatchState();
    for (const step of buildInteractiveSteps("fr")) {
      const snapshot = structuredClone(state);
      const next = step.apply(state);
      assert.deepEqual(state, snapshot, `${step.id} a muté l'état`);
      state = next;
    }
  });

  it("la cible de chaque ancre existe dans l'état affiché", () => {
    for (const { step, before } of transitions) {
      const a = step.anchor;
      if (a.startsWith("coach-hand-") && a !== "coach-hand-zone") {
        assert.ok(before.hand.includes(a.slice("coach-hand-".length) as CardRef), `${step.id} : carte absente de la main`);
      } else if (a.startsWith("coach-field-")) {
        const ref = a.slice("coach-field-".length);
        assert.ok(before.field.some((c) => c.ref === ref && !c.spent), `${step.id} : ${ref} absente ou spent`);
      } else if (a.startsWith("coach-die-")) {
        assert.ok(before.fixer.includes(a.slice("coach-die-".length)), `${step.id} : dé absent du Fixer`);
      } else if (a === "coach-rival-unitJackie") {
        assert.ok(before.rivalField.some((c) => c.ref === "unitJackie"), step.id);
      } else if (a === "coach-eddie") {
        assert.ok(before.eddies.some((e) => !e.spent), `${step.id} : aucun Eddie ready`);
      } else if (a === "coach-legend") {
        assert.ok(before.legends.some((l) => !l.spent), `${step.id} : aucune Legend ready`);
      } else if (a === "coach-legend-call") {
        assert.ok(before.legends.some((l) => l.faceDown), `${step.id} : aucune Legend face cachée`);
      }
    }
  });

  it("main sans doublon (clé React) et ids de cartes en jeu uniques à chaque étape", () => {
    for (const { step, after } of transitions) {
      assert.equal(new Set(after.hand).size, after.hand.length, `${step.id} : doublon en main`);
      const ids = [...after.field, ...after.rivalField, ...after.legends, ...after.eddies].map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, `${step.id} : id en double`);
    }
  });

  it("aucune carte n'est créée ni perdue de ton côté (main + jeu + Eddies + Deck constant)", () => {
    const total = yourCardCount(initialMatchState());
    for (const { step, after } of transitions) {
      assert.equal(yourCardCount(after), total, step.id);
      assert.equal(after.legends.length, 3, `${step.id} : Legends`);
      assert.ok(after.deckCount >= 0, `${step.id} : deck out`);
    }
  });

  it("la Trash ne reçoit que des cartes qui ont quitté le Field", () => {
    for (const { step, before, after } of transitions) {
      const added = after.trash.slice(before.trash.length);
      assert.deepEqual(after.trash.slice(0, before.trash.length), before.trash, `${step.id} : Trash réécrite`);
      for (const ref of added) {
        const left =
          before.rivalField.filter((c) => c.ref === ref).length - after.rivalField.filter((c) => c.ref === ref).length +
          before.field.filter((c) => c.ref === ref).length - after.field.filter((c) => c.ref === ref).length;
        assert.ok(left >= 1, `${step.id} : ${ref} mis à la Trash sans quitter le Field`);
      }
    }
  });

  it("Gigs : un dé du Fixer par Start Phase, d20 en dernier, face ≤ taille du dé", () => {
    for (const { step, before, after } of transitions) {
      if (step.expect.kind !== "die") {
        assert.deepEqual(after.fixer, before.fixer, `${step.id} : Fixer modifié hors Start Phase`);
        continue;
      }
      const die = step.expect.die;
      assert.ok(die !== "d20" || before.fixer.length === 1, `${step.id} : d20 pris avant les autres`);
      assert.equal(after.fixer.length, before.fixer.length - 1);
      assert.ok(!after.fixer.includes(die));
      assert.equal(after.yourGigs.length, before.yourGigs.length + 1);
      const face = after.yourGigs[after.yourGigs.length - 1];
      assert.ok(face >= 1 && face <= Number(die.slice(1)), `${step.id} : face ${face} impossible sur ${die}`);
      assert.equal(after.deckCount, before.deckCount - 1, `${step.id} : pioche de la Start Phase`);
    }
  });

  it("Gigs : au plus un dé apparaît par étape, un vol conserve le total, pas de 7e Gig avant la fin", () => {
    for (const { step, before, after } of transitions) {
      const total = (s: MatchState) => s.yourGigs.length + s.rivalGigs.length;
      const delta = total(after) - total(before);
      // seuls la prise au Fixer (toi) et le Gig du Rival ajoutent un dé ; un vol conserve le total
      assert.ok(delta === 0 || delta === 1, `${step.id} : ${delta} dés apparus`);
      assert.ok(after.yourGigs.length < 7 || after.phase === "end", `${step.id} : victoire non déclarée`);
    }
  });

  it("vols de Gigs conformes à la Power de l'attaquant (Gear compris)", () => {
    let steals = 0;
    for (const { step, before, after } of transitions) {
      const youSteal = step.expect.kind === "target-gigs";
      const rivalSteals = before.rivalAttackerId != null && after.rivalAttackerId == null && after.yourGigs.length < before.yourGigs.length;
      if (!youSteal && !rivalSteals) continue;
      steals += 1;
      const attacker = youSteal
        ? before.field.find((c) => c.id === before.selectedAttackerId)
        : before.rivalField.find((c) => c.id === before.rivalAttackerId);
      assert.ok(attacker, `${step.id} : attaquant introuvable`);
      const moved = youSteal
        ? before.rivalGigs.length - after.rivalGigs.length
        : before.yourGigs.length - after.yourGigs.length;
      assert.equal(moved, Math.min(gigsStolen(powerOf(attacker)), youSteal ? before.rivalGigs.length : before.yourGigs.length), step.id);
      assert.equal(after.yourGigs.length + after.rivalGigs.length, before.yourGigs.length + before.rivalGigs.length);
    }
    assert.ok(steals >= 2, "la démo doit montrer des vols de Gigs");
  });

  it("une attaque est déclarée par une Unit ready, qui devient spent ; la cible Unit doit être spent", () => {
    for (const { step, before, after } of transitions) {
      if (step.expect.kind === "field" && before.rivalAttackerId == null) {
        const attacker = after.field.find((c) => c.id === after.selectedAttackerId);
        assert.ok(attacker && !attacker.spent, `${step.id} : attaquant non ready`);
      }
      if (step.expect.kind === "target-gigs" || step.expect.kind === "target-rival") {
        const attacker = before.field.find((c) => c.id === before.selectedAttackerId);
        assert.ok(attacker, `${step.id} : aucun attaquant sélectionné`);
        assert.ok(after.field.find((c) => c.id === attacker.id)?.spent, `${step.id} : attaquant non spent`);
        assert.equal(after.selectedAttackerId, null);
      }
      if (step.expect.kind === "target-rival") {
        const target = before.rivalField.find((c) => c.ref === (step.expect as { ref?: CardRef }).ref);
        assert.ok(target?.spent, `${step.id} : on ne peut attaquer qu'une Unit spent`);
      }
    }
  });

  it("Blocker : seule une Unit Blocker ready peut intercepter, et aucun Gig n'est volé", () => {
    const blockerRef = keywordExample("Blocker");
    let blocks = 0;
    for (const { step, before, after } of transitions) {
      if (step.expect.kind !== "field" || before.rivalAttackerId == null) continue;
      blocks += 1;
      assert.equal(step.expect.ref, blockerRef, step.id);
      assert.ok(before.field.some((c) => c.ref === blockerRef && !c.spent), `${step.id} : Blocker non ready`);
      assert.deepEqual(after.yourGigs, before.yourGigs, `${step.id} : Gig volé malgré le blocage`);
    }
    assert.ok(blocks >= 1, "la démo doit montrer un blocage");
  });

  it("vente : au plus une par tour, la carte quitte la main et devient 1 Eddie face cachée", () => {
    const salesPerTurn = new Map<number, number>();
    for (const { step, before, after } of transitions) {
      if (after.eddies.length === before.eddies.length) continue;
      assert.equal(after.eddies.length, before.eddies.length + 1, step.id);
      const sold = after.eddies[after.eddies.length - 1];
      assert.ok(sold.faceDown && !sold.spent, step.id);
      assert.ok(before.hand.includes(sold.ref) && after.hand.length === before.hand.length - 1, step.id);
      assert.equal(after.phase, "you", `${step.id} : vente hors de ton tour`);
      salesPerTurn.set(after.turn, (salesPerTurn.get(after.turn) ?? 0) + 1);
    }
    for (const [turn, n] of salesPerTurn) assert.ok(n <= 1, `tour ${turn} : ${n} ventes`);
  });

  it("chaque paiement spend exactement une ressource ready (Eddie ou Legend)", () => {
    for (const { step, before, after } of transitions) {
      if (step.expect.kind === "eddie") {
        assert.equal(spentCount(after.eddies), spentCount(before.eddies) + 1, step.id);
        assert.equal(spentCount(after.legends), spentCount(before.legends), step.id);
      } else if (step.expect.kind === "legend") {
        assert.equal(spentCount(after.legends), spentCount(before.legends) + 1, step.id);
        assert.equal(spentCount(after.eddies), spentCount(before.eddies), step.id);
      }
    }
  });

  it("un paiement sert soit une carte en attente, soit le Call a Legend qui suit", () => {
    transitions.forEach(({ step, before }, i) => {
      if (step.expect.kind !== "eddie" && step.expect.kind !== "legend") return;
      const next = transitions[i + 1]?.step.expect.kind;
      assert.ok(before.pendingPlay != null || next === "call-legend", `${step.id} : paiement sans objet`);
    });
  });

  it("Call a Legend : une seule par tour, payée 1 €$, retourne exactement une Legend", () => {
    const callsPerTurn = new Map<number, number>();
    transitions.forEach(({ step, before, after }, i) => {
      const faceDown = (s: MatchState) => s.legends.filter((l) => l.faceDown).length;
      if (step.expect.kind !== "call-legend") {
        assert.equal(faceDown(after), faceDown(before), `${step.id} : Legend retournée hors Call`);
        return;
      }
      assert.equal(faceDown(after), faceDown(before) - 1, step.id);
      assert.ok(["eddie", "legend"].includes(transitions[i - 1].step.expect.kind), `${step.id} : Call non payé`);
      callsPerTurn.set(after.turn, (callsPerTurn.get(after.turn) ?? 0) + 1);
    });
    for (const [turn, n] of callsPerTurn) assert.ok(n <= 1, `tour ${turn} : ${n} Calls`);
  });

  it("Gear : s'équipe sur une seule de tes Units et reste attaché", () => {
    for (const { step, after } of transitions) {
      const equipped = after.field.filter((c) => c.equipped);
      assert.ok(equipped.length <= 1, step.id);
      for (const c of equipped) {
        assert.equal(EXAMPLE_CARDS[c.equipped!].type, "Gear", step.id);
        assert.equal(EXAMPLE_CARDS[c.ref].type, "Unit", step.id);
      }
    }
    assert.equal(final.field.filter((c) => c.equipped).length, 1, "le Gear doit finir équipé");
  });

  it("tours et phases : progression monotone, fin de partie atteinte à la dernière action", () => {
    let turn = 1;
    for (const { step, after } of transitions) {
      assert.ok(after.turn >= turn, `${step.id} : retour en arrière de tour`);
      turn = after.turn;
      if (step.expect.kind === "end-turn") assert.equal(after.phase, "rival", step.id);
      if (step.expect.kind === "die") assert.equal(after.phase, "you", step.id);
    }
    assert.equal(final.phase, "end");
    assert.equal(final.pendingPlay, null);
    assert.equal(final.selectedAttackerId, null);
    assert.equal(final.rivalAttackerId, null);
    const done = transitions[transitions.length - 1];
    assert.equal(done.after, done.before, "l'étape « done » ne modifie rien");
    assert.ok(transitions.slice(0, -2).every((t) => t.after.phase !== "end"), "fin de partie prématurée");
  });

  it("aucune carte en attente de paiement ne reste bloquée en changeant de tour", () => {
    for (const { step, after } of transitions) {
      if (step.expect.kind === "end-turn" || step.expect.kind === "die") {
        assert.equal(after.pendingPlay, null, step.id);
      }
      assert.equal(after.pendingPlay == null, after.pendingKind == null, step.id);
    }
  });

  // --- Incohérences de règles relevées par la simulation -------------------------------------

  /** Coût payé dans la démo = coût imprimé sur la carte affichée (EXAMPLE_CARDS). */
  for (const { step } of runDemo("fr").transitions.filter((t) => t.step.expect.kind === "hand" && t.after.pendingPlay)) {
    it(`paiement de ${step.id} = coût imprimé de la carte`, () => {
      const { transitions: ts } = runDemo("fr");
      const start = ts.findIndex((t) => t.step.id === step.id);
      const ref = ts[start].after.pendingPlay!;
      let paid = 0;
      for (let i = start + 1; i < ts.length && ts[i].before.pendingPlay; i++) {
        if (ts[i].step.expect.kind === "eddie" || ts[i].step.expect.kind === "legend") paid += 1;
      }
      const cost = cardOf(ref).cost;
      assert.equal(paid, cost, `${ref} : payé ${paid}, coût ${cost}`);
    });
  }

  /** Lag : une Unit jouée ce tour-ci ne peut pas attaquer, sauf Adrenaline. */
  const attackDeclarations = transitions.filter(
    (t) =>
      (t.after.selectedAttackerId != null && t.after.selectedAttackerId !== t.before.selectedAttackerId) ||
      (t.after.rivalAttackerId != null && t.after.rivalAttackerId !== t.before.rivalAttackerId),
  );
  for (const decl of attackDeclarations) {
    it(`Lag respecté à ${decl.step.id} (Adrenaline seule exception)`, () => {
      const adrenaline = keywordExample("Adrenaline");
      const rival = decl.after.rivalAttackerId != null && decl.after.rivalAttackerId !== decl.before.rivalAttackerId;
      const attackerId = rival ? decl.after.rivalAttackerId! : decl.after.selectedAttackerId!;
      // Début du tour de l'attaquant : dernière Start Phase (dé pour toi, fin de ton tour pour le Rival).
      let start = decl.index;
      while (start > 0 && transitions[start - 1].step.expect.kind !== (rival ? "end-turn" : "die")) start -= 1;
      const atTurnStart = transitions[Math.max(0, start - 1)].after;
      const zone = (s: MatchState) => (rival ? s.rivalField : s.field);
      const wasThere = zone(atTurnStart).some((c) => c.id === attackerId);
      const card = zone(decl.after).find((c) => c.id === attackerId)!;
      assert.ok(wasThere || card.ref === adrenaline, `${card.ref} attaque le tour où elle est jouée`);
    });
  }

  /** Combats : la plus haute Power vainc, égalité = les deux à la Trash. */
  const fights = transitions.filter(
    (t) => t.step.expect.kind === "target-rival" || (t.step.expect.kind === "field" && t.before.rivalAttackerId != null),
  );
  for (const fight of fights) {
    it(`issue du combat ${fight.step.id} conforme aux Power`, () => {
      const { before, after, step } = fight;
      let mine: BoardCard | undefined;
      let theirs: BoardCard | undefined;
      if (step.expect.kind === "target-rival") {
        mine = before.field.find((c) => c.id === before.selectedAttackerId);
        theirs = before.rivalField.find((c) => c.ref === (step.expect as { ref?: CardRef }).ref);
      } else {
        mine = before.field.find((c) => c.ref === (step.expect as { ref: CardRef }).ref);
        theirs = before.rivalField.find((c) => c.id === before.rivalAttackerId);
      }
      assert.ok(mine && theirs, "combattants introuvables");
      const pm = powerOf(mine);
      const pt = powerOf(theirs);
      const mineSurvives = after.field.some((c) => c.id === mine.id);
      const theirsSurvives = after.rivalField.some((c) => c.id === theirs.id);
      assert.equal(mineSurvives, pm > pt, `${mine.ref} (${pm}) vs ${theirs.ref} (${pt}) : ton Unit`);
      assert.equal(theirsSurvives, pt > pm, `${mine.ref} (${pm}) vs ${theirs.ref} (${pt}) : Unit du Rival`);
    });
  }

  /** Le texte « Power N » d'une étape de vol doit citer la Power réelle de l'attaquant. */
  const stealSteps = transitions.filter(
    (t) => t.step.expect.kind === "target-gigs" || (t.before.rivalAttackerId != null && t.after.yourGigs.length < t.before.yourGigs.length),
  );
  for (const t of stealSteps) {
    it(`la Power citée à ${t.step.id} est celle de l'attaquant`, () => {
      const attacker =
        t.step.expect.kind === "target-gigs"
          ? t.before.field.find((c) => c.id === t.before.selectedAttackerId)
          : t.before.rivalField.find((c) => c.id === t.before.rivalAttackerId);
      assert.ok(attacker);
      for (const locale of ["fr", "en"] as const) {
        const text = buildInteractiveSteps(locale)[t.index].explain;
        const cited = [...text.matchAll(/\b(?:P|Power )(\d+)\b(?!\+)/g)].map((m) => Number(m[1]));
        for (const n of cited) assert.equal(n, powerOf(attacker), `${locale} : « ${text} »`);
      }
    });
  }

  /** Le nombre de Gigs affiché par la bannière finale (flash « finale ») correspond à l'état. */
  it("le compte de Gigs annoncé en fin de démo correspond à l'état", () => {
    const finale = transitions.find((t) => t.after.flash === "finale");
    assert.ok(finale);
    const needed = Number(demoTableCopy("fr").fx.winSub.match(/\d+/)![0]);
    assert.ok(finale.after.yourGigs.length >= needed, `${finale.after.yourGigs.length} Gigs < ${needed}`);
  });
});

describe("Démo interactive — textes de la table", () => {
  function assertFilled(value: unknown, path: string): void {
    if (typeof value === "string") assert.ok(value.trim(), `${path} vide`);
    else if (typeof value === "function") assert.ok(String((value as (x: never) => string)("3" as never)).trim(), path);
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) assertFilled(v, `${path}.${k}`);
    }
  }

  it("FR et EN complets, mêmes clés", () => {
    const fr = demoTableCopy("fr");
    const en = demoTableCopy("en");
    assertFilled(fr, "fr");
    assertFilled(en, "en");
    assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
    assert.deepEqual(Object.keys(fr.fx).sort(), Object.keys(en.fx).sort());
    assert.notEqual(fr.title, en.title);
  });

  it("toutes les locales de l'app ont une table (fr natif, sinon en)", () => {
    for (const { id } of LOCALES) {
      assert.deepEqual(
        JSON.stringify(demoTableCopy(id)),
        JSON.stringify(demoTableCopy(id === "fr" ? "fr" : "en")),
        id,
      );
    }
  });

  it("libellés de tour et Street Cred incluent leur paramètre", () => {
    for (const c of [demoTableCopy("fr"), demoTableCopy("en")]) {
      assert.match(c.turnYou(2), /\b2\b/);
      assert.match(c.turnRival(3), /\b3\b/);
      assert.match(c.fx.streetCred("10"), /\b10\b/);
    }
  });
});
