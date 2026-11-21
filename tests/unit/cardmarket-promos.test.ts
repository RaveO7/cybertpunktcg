import { describe, expect, it } from "vitest";
import { matchCardmarketPrices, productNameKey, type CardmarketProduct } from "@/lib/cardmarket";
import { planPromoProducts, splitPromoName } from "@/lib/cardmarket-promos";

const product = (idProduct: number, name: string, idExpansion: number): CardmarketProduct => ({
  idProduct,
  name,
  idExpansion,
  expansionName: null,
  number: null,
});

describe("planPromoProducts", () => {
  const catalog = new Map([["PRM01", new Set([productNameKey("Rebecca — Having a Moment")])]]);

  it("ajoute les promos de « Set 1 Promos » absentes du catalogue, même sans prix", () => {
    const plan = planPromoProducts(
      [product(904772, "Rebecca - Having a Moment", 6719), product(924040, "Jackie & V — Chooms to the End", 6719)],
      catalog,
    );
    expect(plan.missing.map((entry) => [entry.product.idProduct, entry.setCode])).toEqual([[924040, "PRM01"]]);
    expect(plan.covered).toEqual([904772]);
  });

  it("ignore les autres extensions et une extension promo absente du catalogue", () => {
    expect(planPromoProducts([product(1, "Inconnue", 6722)], catalog)).toEqual({ missing: [], covered: [] });
    expect(planPromoProducts([product(2, "Jackie & V", 6719)], new Map())).toEqual({ missing: [], covered: [] });
  });
});

describe("splitPromoName", () => {
  it("sépare le nom et le sous-titre", () => {
    expect(splitPromoName("Jackie & V — Chooms to the End")).toEqual({ name: "Jackie & V", subname: "Chooms to the End" });
    expect(splitPromoName("Adam Smasher - Ender of Legends")).toEqual({ name: "Adam Smasher", subname: "Ender of Legends" });
    expect(splitPromoName("MaxTac Squadron")).toEqual({ name: "MaxTac Squadron", subname: null });
  });
});

describe("faute de nom Cardmarket", () => {
  it("relie « Tetratonic Rippler » à la carte « Tetratronic Rippler » de The Heist", () => {
    const report = matchCardmarketPrices(
      [product(10, "Tetratonic Rippler", 6715), product(11, "Merc Pistol", 6715)],
      new Map([
        [10, 0.5],
        [11, 0.2],
      ]),
      [{ code: "theheistbetastarterdeck", name: "The Heist Beta Starter Deck" }],
      [
        { id: "p-rippler", setCode: "theheistbetastarterdeck", collectorNumber: "001", name: "Tetratronic Rippler" },
        { id: "p-pistol", setCode: "theheistbetastarterdeck", collectorNumber: "002", name: "Merc Pistol" },
      ],
    );
    expect(report.assignments.find((assignment) => assignment.printingId === "p-rippler")?.amount).toBe("0.50");
  });
});
