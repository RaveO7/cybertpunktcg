import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { TournamentError } from "../../src/lib/tournament/errors";
import {
  confirmOnSite,
  confirmResult,
  declareResult,
  isOverdue,
  noShowResult,
  organizerSetResult,
  refuseResult,
  resetResult,
  resultOf,
  type MatchContext,
  type MatchState,
} from "../../src/lib/tournament/match-state";
import type { MatchResult } from "../../src/lib/tournament/scores";

const NOW = new Date("2026-10-10T20:00:00Z");
const ctx: MatchContext = { matchType: "bo3", phase: "swiss", oneDeviceMode: "direct", now: NOW };
const fresh: MatchState = {
  status: "en_cours",
  kind: "normal",
  gamesA: null,
  gamesB: null,
  declA: null,
  declB: null,
  declaredAt: null,
  confirmedOnSite: false,
  isBye: false,
};
const score = (gamesA: number, gamesB: number): MatchResult => ({ kind: "normal", gamesA, gamesB });

function rejects(fn: () => unknown, message: string | RegExp, status?: number) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof TournamentError);
    if (typeof message === "string") assert.equal(error.message, message);
    else assert.match(error.message, message);
    if (status !== undefined) assert.equal(error.status, status);
    return true;
  });
}

describe("les deux joueurs ont l'app", () => {
  it("déclaration puis confirmation : validé", () => {
    const declared = declareResult(fresh, "A", score(2, 1), ctx);
    assert.equal(declared.status, "declare");
    assert.equal(declared.declaredAt, NOW);
    assert.equal(resultOf(declared), null, "un match déclaré ne compte pas");
    const done = confirmResult(declared, "B");
    assert.equal(done.status, "valide");
    assert.deepEqual(resultOf(done), score(2, 1));
  });

  it("désaccord : contesté", () => {
    const contested = refuseResult(declareResult(fresh, "A", score(2, 1), ctx), "B");
    assert.equal(contested.status, "conteste");
  });

  it("le déclarant peut modifier sa déclaration avant confirmation", () => {
    const first = declareResult(fresh, "A", score(2, 1), ctx);
    const second = declareResult(first, "A", score(2, 0), ctx);
    assert.equal(second.status, "declare");
    assert.deepEqual(second.declA, score(2, 0));
  });

  it("on ne confirme pas sa propre déclaration", () => {
    rejects(() => confirmResult(declareResult(fresh, "A", score(2, 1), ctx), "A"), "Vous ne pouvez pas confirmer votre propre déclaration.");
    rejects(() => confirmResult(fresh, "B"), "Aucun score à confirmer.");
    rejects(() => refuseResult(fresh, "B"), "Aucun score à refuser.");
  });
});

describe("déclarations concurrentes", () => {
  it("identiques : validé", () => {
    const done = declareResult(declareResult(fresh, "A", score(2, 0), ctx), "B", score(2, 0), ctx);
    assert.equal(done.status, "valide");
    assert.deepEqual(resultOf(done), score(2, 0));
  });

  it("différentes : contesté, les deux scores sont conservés", () => {
    const contested = declareResult(declareResult(fresh, "A", score(2, 1), ctx), "B", score(1, 2), ctx);
    assert.equal(contested.status, "conteste");
    assert.deepEqual(contested.declA, score(2, 1));
    assert.deepEqual(contested.declB, score(1, 2));
  });

  it("un match contesté ou validé n'accepte plus de déclaration joueur", () => {
    const contested = declareResult(declareResult(fresh, "A", score(2, 1), ctx), "B", score(1, 2), ctx);
    rejects(() => declareResult(contested, "A", score(2, 0), ctx), /l'organisateur doit trancher/, 409);
    const done = confirmResult(declareResult(fresh, "A", score(2, 1), ctx), "B");
    rejects(() => declareResult(done, "B", score(0, 2), ctx), "Ce match est déjà validé.", 409);
  });
});

describe("un seul joueur a l'app", () => {
  it("mode direct : la confirmation sur place valide", () => {
    const done = confirmOnSite(declareResult(fresh, "A", score(2, 1), ctx), "A", ctx);
    assert.equal(done.status, "valide");
    assert.equal(done.confirmedOnSite, true);
  });

  it("mode organisateur : reste déclaré, marqué confirmé sur place, le TO valide en un clic", () => {
    const orgCtx: MatchContext = { ...ctx, oneDeviceMode: "organizer" };
    const pending = confirmOnSite(declareResult(fresh, "A", score(2, 1), orgCtx), "A", orgCtx);
    assert.equal(pending.status, "declare");
    assert.equal(pending.confirmedOnSite, true);
    const done = organizerSetResult(pending, pending.declA!, orgCtx);
    assert.equal(done.status, "valide");
  });

  it("refuse une confirmation sur place sans déclaration", () => {
    rejects(() => confirmOnSite(fresh, "A", ctx), "Aucun score à confirmer.");
  });
});

describe("ID et résultats réservés", () => {
  it("ID déclaré et confirmé : nul 0-0", () => {
    const id: MatchResult = { kind: "id", gamesA: 0, gamesB: 0 };
    const done = confirmResult(declareResult(fresh, "A", id, ctx), "B");
    assert.deepEqual(resultOf(done), id);
  });

  it("un joueur ne peut pas déclarer une double défaite", () => {
    rejects(() => declareResult(fresh, "A", { kind: "double_loss", gamesA: 0, gamesB: 0 }, ctx), "Résultat réservé à l'organisateur.", 403);
  });

  it("score impossible refusé", () => {
    rejects(() => declareResult(fresh, "A", score(3, 0), ctx), "Score invalide.");
    rejects(() => declareResult(fresh, "A", score(1, 1), { ...ctx, phase: "top_cut" }), "Un vainqueur est requis en top cut.");
  });
});

describe("pouvoirs de l'organisateur", () => {
  it("tranche une contestation, quel que soit l'état", () => {
    const contested = declareResult(declareResult(fresh, "A", score(2, 1), ctx), "B", score(1, 2), ctx);
    const done = organizerSetResult(contested, score(1, 2), ctx);
    assert.equal(done.status, "valide");
    assert.deepEqual(resultOf(done), score(1, 2));
    // Correction d'un match déjà validé.
    assert.deepEqual(resultOf(organizerSetResult(done, score(2, 0), ctx)), score(2, 0));
  });

  it("saisit une double défaite en suisse, pas en top cut", () => {
    const loss: MatchResult = { kind: "double_loss", gamesA: 0, gamesB: 0 };
    assert.equal(organizerSetResult(fresh, loss, ctx).status, "valide");
    rejects(() => organizerSetResult(fresh, loss, { ...ctx, phase: "top_cut" }), "Un vainqueur est requis en top cut.");
  });

  it("no-show : victoire 2-0 (1-0 en Bo1) pour l'adversaire", () => {
    assert.deepEqual(resultOf(noShowResult(fresh, "B", ctx)), { kind: "no_show", gamesA: 2, gamesB: 0 });
    assert.deepEqual(resultOf(noShowResult(fresh, "A", { ...ctx, matchType: "bo1" })), { kind: "no_show", gamesA: 0, gamesB: 1 });
  });

  it("annule un résultat : le match redevient en cours", () => {
    const reset = resetResult(confirmResult(declareResult(fresh, "A", score(2, 1), ctx), "B"));
    assert.deepEqual(reset, fresh);
  });

  it("un bye ne se déclare ni ne se modifie", () => {
    const bye: MatchState = { ...fresh, isBye: true, status: "valide", kind: "bye", gamesA: 2, gamesB: 0 };
    rejects(() => declareResult(bye, "A", score(2, 0), ctx), "Un bye n'a pas de résultat à déclarer.");
    rejects(() => organizerSetResult(bye, score(0, 2), ctx), "Un bye ne se modifie pas.");
    rejects(() => resetResult(bye), "Un bye ne se modifie pas.");
  });
});

describe("déclaration non confirmée", () => {
  it("signalée après le délai, jamais validée automatiquement", () => {
    const declared = declareResult(fresh, "A", score(2, 1), ctx);
    assert.equal(isOverdue(declared, new Date(NOW.getTime() + 9 * 60_000), 10), false);
    assert.equal(isOverdue(declared, new Date(NOW.getTime() + 12 * 60_000), 10), true);
    assert.equal(declared.status, "declare");
    assert.equal(isOverdue(fresh, new Date(NOW.getTime() + 60 * 60_000), 10), false);
  });
});
