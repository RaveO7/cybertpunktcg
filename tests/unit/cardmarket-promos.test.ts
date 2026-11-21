import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALPHA_KIT_DETAILS } from "@/lib/alpha-kit-data";
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

  it("ajoute tous les produits d'une extension inconnue de netdeck (Alpha Kit)", () => {
    const plan = planPromoProducts(
      [product(904968, "Saburo Arasaka - Stubborn Patriarch", 6722), product(904922, "Saburo Arasaka - Stubborn Patriarch", 6722)],
      new Map([...catalog, ["alphakit", new Set<string>()]]),
    );
    expect(plan.missing.map((entry) => [entry.product.idProduct, entry.setCode])).toEqual([
      [904968, "alphakit"],
      [904922, "alphakit"],
    ]);
  });

  it("ignore les autres extensions et une extension promo absente du catalogue", () => {
    expect(planPromoProducts([product(1, "Inconnue", 6714)], catalog)).toEqual({ missing: [], covered: [] });
    expect(planPromoProducts([product(2, "Jackie & V", 6719)], new Map())).toEqual({ missing: [], covered: [] });
  });
});

describe("ALPHA_KIT_DETAILS", () => {
  it("donne A001–A031 une seule fois, chacun avec son image dans public/card-images", () => {
    const details = Object.values(ALPHA_KIT_DETAILS);
    expect(details.map((entry) => entry.collectorNumber).toSorted()).toEqual(
      Array.from({ length: 31 }, (_, index) => `A${String(index + 1).padStart(3, "0")}`),
    );
    for (const entry of details) expect(existsSync(path.join("public", entry.imagePath))).toBe(true);
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
