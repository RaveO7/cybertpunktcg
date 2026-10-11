import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  chooseBye,
  moveBye,
  pairFirstRound,
  pairingWarnings,
  pairSwissRound,
  swapPlayers,
  swissRoundCount,
  type PairedMatch,
  type PairingPlayer,
} from "../../src/lib/tournament/pairing";
import { randomInt, seededRng, type Rng } from "../../src/lib/tournament/random";
import { computeStandings, type StandingsMatch, type StandingsPlayer } from "../../src/lib/tournament/standings";
import type { MatchResult } from "../../src/lib/tournament/scores";

const p = (id: string, points: number, opponentIds: string[] = [], hadBye = false): PairingPlayer => ({
  id,
  points,
  hadBye,
  opponentIds,
});

function assertEveryoneOnce(matches: PairedMatch[], ids: string[]) {
  const seen = matches.flatMap((match) => (match.b === null ? [match.a] : [match.a, match.b]));
  assert.deepEqual([...seen].sort(), [...ids].sort());
}

describe("nombre de rondes", () => {
  it("boutique : toujours 3", () => {
    assert.equal(swissRoundCount("boutique", 30), 3);
    assert.equal(swissRoundCount("boutique", 4), 3);
  });

  it("compétitif : ⌈log₂(n)⌉, au moins 3", () => {
    assert.equal(swissRoundCount("competitif", 20), 5);
    assert.equal(swissRoundCount("competitif", 8), 3);
    assert.equal(swissRoundCount("competitif", 4), 3);
    assert.equal(swissRoundCount("competitif", 64), 6);
    assert.equal(swissRoundCount("competitif", 65), 7);
  });
});

describe("ronde 1", () => {
  it("8 joueurs : 4 matchs, ordre aléatoire", () => {
    const ids = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const first = pairFirstRound(ids, seededRng(1));
    assert.equal(first.length, 4);
    assertEveryoneOnce(first, ids);
    assert.notDeepEqual(first, pairFirstRound(ids, seededRng(2)));
  });

  it("nombre impair : un bye", () => {
    const matches = pairFirstRound(["A", "B", "C"], seededRng(3));
    assert.equal(matches.filter((match) => match.b === null).length, 1);
    assert.equal(matches[matches.length - 1].b, null, "le bye est en dernière table");
  });

  it("refuse moins de 2 joueurs", () => {
    assert.throws(() => pairFirstRound(["A"], seededRng(1)), /au moins 2 joueurs/);
  });
});

describe("bye", () => {
  it("au moins bien classé qui n'en a pas eu", () => {
    assert.equal(chooseBye([p("A", 6), p("B", 3), p("C", 0, [], true), p("D", 0)]), "D");
    assert.equal(chooseBye([p("A", 6), p("B", 3), p("C", 0, [], true)]), "B");
  });

  it("tout le monde a eu un bye : le dernier en reçoit un second (signalé)", () => {
    const players = [p("A", 6, [], true), p("B", 3, [], true), p("C", 0, [], true)];
    assert.equal(chooseBye(players), "C");
    const matches = pairSwissRound(players);
    assert.deepEqual(pairingWarnings(matches, players), [{ type: "second_bye", playerId: "C" }]);
  });

  it("7 joueurs : 3 matchs et un bye", () => {
    const players = ["A", "B", "C", "D", "E", "F", "G"].map((id, index) => p(id, index < 3 ? 3 : 0));
    const matches = pairSwissRound(players);
    assert.equal(matches.length, 4);
    assert.deepEqual(matches[3], { a: "G", b: null });
  });
});

describe("appariement suisse", () => {
  it("apparie les joueurs de même nombre de points", () => {
    const matches = pairSwissRound([p("A", 3), p("B", 3), p("C", 0), p("D", 0)]);
    assert.deepEqual(matches, [{ a: "A", b: "B" }, { a: "C", b: "D" }]);
  });

  it("pas de revanche quand c'est possible", () => {
    const players = [p("A", 3, ["C"]), p("B", 3, ["D"]), p("C", 0, ["A"]), p("D", 0, ["B"])];
    // A–B est possible, mais pas si A et B s'étaient déjà affrontés :
    const repeat = [p("A", 3, ["B"]), p("B", 3, ["A"]), p("C", 0, ["D"]), p("D", 0, ["C"])];
    assert.deepEqual(pairSwissRound(players), [{ a: "A", b: "B" }, { a: "C", b: "D" }]);
    const matches = pairSwissRound(repeat);
    assert.deepEqual(pairingWarnings(matches, repeat), []);
    for (const match of matches) assert.notDeepEqual([match.a, match.b].sort(), ["A", "B"]);
  });

  it("groupe impair : le joueur seul descend dans le groupe immédiatement inférieur", () => {
    const players = [p("A", 6), p("B", 6), p("C", 6), p("D", 3), p("E", 3), p("F", 0)];
    const matches = pairSwissRound(players);
    const opponentOfC = matches.find((match) => match.a === "C" || match.b === "C")!;
    const other = opponentOfC.a === "C" ? opponentOfC.b : opponentOfC.a;
    assert.ok(other === "D" || other === "E", `C affronte ${other}`);
    // Personne ne saute deux groupes : F (0) affronte un joueur à 3.
    const opponentOfF = matches.find((match) => match.a === "F" || match.b === "F")!;
    assert.notEqual(opponentOfF.a === "F" ? opponentOfF.b : opponentOfF.a, "A");
  });

  it("4 joueurs en 4e ronde : revanches inévitables, signalées, ronde appariée", () => {
    const all = ["A", "B", "C", "D"];
    const players = all.map((id, index) => p(id, 9 - 3 * index, all.filter((other) => other !== id)));
    const matches = pairSwissRound(players);
    assertEveryoneOnce(matches, all);
    assert.equal(pairingWarnings(matches, players).filter((warning) => warning.type === "rematch").length, 2);
  });

  it("minimise le nombre de revanches", () => {
    // A a joué B, C et D ; E–F jamais joué : une seule revanche suffit (A avec l'un des autres).
    const players = [p("A", 9, ["B", "C", "D"]), p("B", 6, ["A"]), p("C", 6, ["A"]), p("D", 3, ["A"]), p("E", 3), p("F", 0)];
    const matches = pairSwissRound(players);
    assert.ok(pairingWarnings(matches, players).length <= 1);
  });
});

describe("corrections manuelles", () => {
  const base: PairedMatch[] = [{ a: "A", b: "B" }, { a: "C", b: "D" }, { a: "E", b: null }];

  it("échange de deux joueurs entre deux tables", () => {
    assert.deepEqual(swapPlayers(base, "B", "D"), [{ a: "A", b: "D" }, { a: "C", b: "B" }, { a: "E", b: null }]);
  });

  it("échange avec le joueur du bye", () => {
    assert.deepEqual(swapPlayers(base, "E", "A"), [{ a: "E", b: "B" }, { a: "C", b: "D" }, { a: "A", b: null }]);
  });

  it("déplace le bye", () => {
    assert.deepEqual(moveBye(base, "C"), [{ a: "A", b: "B" }, { a: "E", b: "D" }, { a: "C", b: null }]);
  });

  it("signale une revanche créée par une correction", () => {
    const players = [p("A", 3, ["D"]), p("B", 3), p("C", 0), p("D", 0, ["A"]), p("E", 0)];
    assert.deepEqual(pairingWarnings(swapPlayers(base, "B", "D"), players), [{ type: "rematch", a: "A", b: "D" }]);
  });

  it("refuse un joueur absent de la ronde", () => {
    assert.throws(() => swapPlayers(base, "A", "Z"), /Joueur absent/);
  });
});

describe("simulation de tournois complets", () => {
  function randomResult(rng: Rng): MatchResult {
    const outcomes: [number, number][] = [[2, 0], [2, 1], [1, 2], [0, 2], [1, 1], [1, 0]];
    const [gamesA, gamesB] = outcomes[randomInt(rng, outcomes.length)];
    return { kind: "normal", gamesA, gamesB };
  }

  it("de 3 à 64 joueurs, sans plantage ni joueur oublié, sans revanche évitable en début de tournoi", () => {
    const rng = seededRng(99);
    for (let size = 3; size <= 64; size += 1) {
      const ids = Array.from({ length: size }, (_, i) => `P${i}`);
      const players: StandingsPlayer[] = ids.map((id) => ({ id, name: id, status: "active", missedRounds: 0 }));
      const history: StandingsMatch[] = [];
      const rounds = swissRoundCount("competitif", size);
      for (let round = 1; round <= rounds; round += 1) {
        let matches: PairedMatch[];
        let pairingPlayers: PairingPlayer[] = [];
        if (round === 1) {
          matches = pairFirstRound(ids, rng);
        } else {
          const standings = computeStandings(players, history);
          pairingPlayers = standings.map((row) => ({
            id: row.playerId,
            points: row.points,
            hadBye: row.hadBye,
            opponentIds: row.opponentIds,
          }));
          matches = pairSwissRound(pairingPlayers);
        }
        assertEveryoneOnce(matches, ids);
        if (round > 1 && size >= 2 ** round) {
          assert.equal(
            pairingWarnings(matches, pairingPlayers).filter((warning) => warning.type === "rematch").length,
            0,
            `revanche évitable : ${size} joueurs, ronde ${round}`,
          );
        }
        for (const match of matches) {
          history.push({
            round,
            phase: "swiss",
            playerAId: match.a,
            playerBId: match.b,
            result: match.b === null ? { kind: "bye", gamesA: 2, gamesB: 0 } : randomResult(rng),
          });
        }
      }
      // Personne n'a eu deux byes tant qu'il reste des joueurs sans bye.
      const byes = history.filter((match) => match.playerBId === null).map((match) => match.playerAId);
      assert.equal(new Set(byes).size, byes.length, `${size} joueurs : bye en double`);
    }
  });
});
