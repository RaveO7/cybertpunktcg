import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  computeFinalStandings,
  computeStandings,
  PERCENT_FLOOR,
  type StandingsMatch,
  type StandingsPlayer,
} from "../../src/lib/tournament/standings";
import type { MatchResult } from "../../src/lib/tournament/scores";

const player = (id: string, partial: Partial<StandingsPlayer> = {}): StandingsPlayer => ({
  id,
  name: id,
  status: "active",
  missedRounds: 0,
  ...partial,
});
const r = (gamesA: number, gamesB: number, kind: MatchResult["kind"] = "normal"): MatchResult => ({ kind, gamesA, gamesB });
const m = (round: number, a: string, b: string | null, result: MatchResult | null): StandingsMatch => ({
  round,
  phase: "swiss",
  playerAId: a,
  playerBId: b,
  result,
});
const byId = (rows: ReturnType<typeof computeStandings>, id: string) => rows.find((row) => row.playerId === id)!;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

describe("points de match", () => {
  it("deux victoires et un nul = 7 points", () => {
    const rows = computeStandings(
      [player("A"), player("B"), player("C"), player("D")],
      [m(1, "A", "B", r(2, 0)), m(2, "A", "C", r(2, 1)), m(3, "A", "D", r(1, 1))],
    );
    const a = byId(rows, "A");
    assert.equal(a.points, 7);
    assert.deepEqual([a.wins, a.draws, a.losses], [2, 1, 0]);
  });

  it("bye = 3 points, double défaite = 0 pour les deux", () => {
    const rows = computeStandings(
      [player("A"), player("B"), player("C")],
      [m(1, "A", null, r(2, 0, "bye")), m(1, "B", "C", r(0, 0, "double_loss"))],
    );
    assert.equal(byId(rows, "A").points, 3);
    assert.equal(byId(rows, "B").points, 0);
    assert.equal(byId(rows, "C").points, 0);
    assert.equal(byId(rows, "C").losses, 1);
  });

  it("un match non validé ne compte pas", () => {
    const rows = computeStandings([player("A"), player("B")], [m(1, "A", "B", null)]);
    assert.equal(byId(rows, "A").points, 0);
    assert.equal(byId(rows, "A").matchesPlayed, 0);
  });

  it("le top cut ne change pas les points de match", () => {
    const rows = computeStandings([player("A"), player("B")], [{ ...m(4, "A", "B", r(2, 0)), phase: "top_cut" }]);
    assert.equal(byId(rows, "A").points, 0);
  });
});

describe("pourcentages", () => {
  it("plancher de 33 % pour un joueur à 0 victoire", () => {
    const rows = computeStandings(
      [player("A"), player("B"), player("C"), player("D")],
      [m(1, "B", "A", r(2, 0)), m(2, "C", "A", r(2, 0)), m(3, "D", "A", r(2, 0))],
    );
    assert.equal(byId(rows, "A").matchWinPct, PERCENT_FLOOR);
  });

  it("GW% : 2-1 puis 2-0 = 4 manches sur 5 = 80 %", () => {
    const rows = computeStandings(
      [player("A"), player("B"), player("C")],
      [m(1, "A", "B", r(2, 1)), m(2, "A", "C", r(2, 0))],
    );
    close(byId(rows, "A").gwPct, 0.8);
  });

  it("GW% : un bye vaut deux manches gagnées, un ID zéro manche", () => {
    const rows = computeStandings(
      [player("A"), player("B"), player("C")],
      [m(1, "A", null, r(2, 0, "bye")), m(2, "A", "B", r(0, 0, "id")), m(3, "A", "C", r(1, 2))],
    );
    close(byId(rows, "A").gwPct, 3 / 5);
  });

  it("OMW% exclut le bye : moyenne des adversaires réels", () => {
    // A : bye puis bat B et C. B finit à 2/3, C à 1/3 de victoires → plancher 0,33.
    const rows = computeStandings(
      [player("A"), player("B"), player("C"), player("D"), player("E")],
      [
        m(1, "A", null, r(2, 0, "bye")),
        m(1, "B", "D", r(2, 0)),
        m(1, "C", "E", r(0, 2)),
        m(2, "A", "B", r(2, 0)),
        m(3, "A", "C", r(2, 0)),
        m(3, "B", "E", r(2, 0)),
      ],
    );
    const b = byId(rows, "B");
    const c = byId(rows, "C");
    close(b.matchWinPct, 2 / 3);
    close(c.matchWinPct, PERCENT_FLOOR);
    close(byId(rows, "A").omwPct, (2 / 3 + PERCENT_FLOOR) / 2);
    assert.deepEqual(byId(rows, "A").opponentIds, ["B", "C"]);
  });

  it("un adversaire droppé reste dans l'OMW% avec ses résultats arrêtés", () => {
    const rows = computeStandings(
      [player("A"), player("B", { status: "dropped" }), player("C"), player("D")],
      [m(1, "B", "C", r(2, 0)), m(2, "A", "B", r(2, 0))],
    );
    close(byId(rows, "B").matchWinPct, 0.5);
    close(byId(rows, "A").omwPct, 0.5);
    assert.equal(byId(rows, "B").status, "dropped");
  });

  it("retardataire en mode « défaite » : rondes manquées comptées en défaites", () => {
    const players = [player("A"), player("B"), player("L", { missedRounds: 2 })];
    const matches = [m(3, "L", "A", r(2, 0))];
    const zero = byId(computeStandings(players, matches, "zero"), "L");
    const loss = byId(computeStandings(players, matches, "loss"), "L");
    assert.equal(zero.matchesPlayed, 1);
    close(zero.matchWinPct, 1);
    assert.equal(loss.matchesPlayed, 3);
    assert.equal(loss.losses, 2);
    close(loss.matchWinPct, 1 / 3);
    // Ses défaites fictives n'ont pas d'adversaire.
    assert.deepEqual(loss.opponentIds, ["A"]);
  });
});

describe("ordre du classement", () => {
  it("à égalité de points, le meilleur OMW% passe devant", () => {
    // A et B gagnent chacun une fois ; l'adversaire battu par A a ensuite gagné, celui de B non.
    const rows = computeStandings(
      [player("A"), player("B"), player("C"), player("D"), player("E"), player("F")],
      [m(1, "A", "C", r(2, 0)), m(1, "B", "D", r(2, 0)), m(2, "C", "E", r(2, 0)), m(2, "D", "F", r(0, 2))],
    );
    assert.ok(byId(rows, "A").rank < byId(rows, "B").rank);
  });

  it("égalité parfaite : même rang", () => {
    const rows = computeStandings([player("A"), player("B")], []);
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[1].rank, 1);
  });

  it("les joueurs en attente d'approbation ne sont pas classés, les DQ le sont", () => {
    const rows = computeStandings([player("A"), player("P", { status: "pending" }), player("Q", { status: "dq" })], []);
    assert.deepEqual(rows.map((row) => row.playerId).sort(), ["A", "Q"]);
  });
});

describe("classement final", () => {
  it("le 1er du suisse éliminé en demi-finale finit 3e ou 4e", () => {
    const players = ["S1", "S2", "S3", "S4"].map((id) => player(id));
    const swissMatches = [m(1, "S1", "S4", r(2, 0)), m(1, "S2", "S3", r(2, 0)), m(2, "S1", "S2", r(2, 0)), m(2, "S3", "S4", r(2, 0))];
    const swiss = computeStandings(players, swissMatches);
    assert.equal(swiss[0].playerId, "S1");
    const cut: StandingsMatch[] = [
      { round: 3, phase: "top_cut", playerAId: "S1", playerBId: "S4", result: r(0, 2) },
      { round: 3, phase: "top_cut", playerAId: "S2", playerBId: "S3", result: r(2, 0) },
      { round: 4, phase: "top_cut", playerAId: "S4", playerBId: "S2", result: r(2, 1) },
    ];
    const final = computeFinalStandings(swiss, cut, "S4");
    assert.deepEqual(
      final.map((row) => row.playerId),
      ["S4", "S2", "S1", "S3"],
    );
    assert.equal(final[0].champion, true);
    assert.equal(final[2].finalRank, 3);
  });
});
