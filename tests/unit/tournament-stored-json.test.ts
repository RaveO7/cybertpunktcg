import { describe, expect, it } from "vitest";
import { readCommandResult, readCutDrawList, readCutState, readMatchResult } from "@/lib/tournament/stored-json";

describe("colonnes JSON du tournoi", () => {
  it("relit un résultat de match valide et refuse les autres formes", () => {
    expect(readMatchResult(JSON.stringify({ kind: "normal", gamesA: 2, gamesB: 1 }))).toEqual({
      kind: "normal",
      gamesA: 2,
      gamesB: 1,
    });
    expect(readMatchResult(JSON.stringify({ kind: "inconnu", gamesA: 2, gamesB: 1 }))).toBeNull();
    expect(readMatchResult(JSON.stringify({ kind: "normal", gamesA: "2", gamesB: 1 }))).toBeNull();
    expect(readMatchResult("{pas du json")).toBeNull();
    expect(readMatchResult(null)).toBeNull();
  });

  it("relit le top cut et le tirage, avec repli si la colonne est invalide", () => {
    expect(readCutState(JSON.stringify({ size: 8, seeds: ["a", "b"] }))).toEqual({ size: 8, seeds: ["a", "b"] });
    expect(readCutState(JSON.stringify({ size: 8, seeds: [1] }))).toBeNull();
    expect(readCutDrawList(JSON.stringify([{ tied: ["a"], picked: ["a"], at: "2026-01-01" }]))).toHaveLength(1);
    expect(readCutDrawList(JSON.stringify({ tied: [] }))).toEqual([]);
    expect(readCutDrawList(null)).toEqual([]);
  });

  it("relit un résultat de commande rejoué et lève sur un journal corrompu", () => {
    expect(readCommandResult(JSON.stringify({ ok: true, data: { id: "x" } }))).toEqual({
      ok: true,
      data: { id: "x" },
      replayed: true,
    });
    expect(() => readCommandResult(JSON.stringify({ ok: false }))).toThrow();
    expect(() => readCommandResult(JSON.stringify({ ok: true, warnings: [{ type: "autre" }] }))).toThrow();
  });
});
