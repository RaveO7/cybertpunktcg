import { normalizeText } from "./logic";

export type SealedProduct = {
  idProduct: number;
  name: string;
  categoryName: string;
  idCategory: number | null;
  idExpansion: number | null;
};

export type SealedCategory = {
  code: string;
  name: string;
  sortOrder: number;
  cardType: "Sealed" | "Lot";
};

const CATEGORY_BY_ID: Record<number, SealedCategory> = {
  1662: { code: "sealed-boosters", name: "Boosters scellés", sortOrder: 900, cardType: "Sealed" },
  1670: { code: "sealed-booster-boxes", name: "Booster Boxes", sortOrder: 910, cardType: "Sealed" },
  1671: { code: "sealed-starter-decks", name: "Starter Decks scellés", sortOrder: 920, cardType: "Sealed" },
  1672: { code: "sealed-box-sets", name: "Box Sets / Kits", sortOrder: 930, cardType: "Sealed" },
  1663: { code: "sealed-lots", name: "Lots & sets", sortOrder: 940, cardType: "Lot" },
};

const CATEGORY_BY_NAME: Record<string, SealedCategory> = {
  "cyberpunk booster": CATEGORY_BY_ID[1662],
  "cyberpunk booster boxes": CATEGORY_BY_ID[1670],
  "cyberpunk starter decks": CATEGORY_BY_ID[1671],
  "cyberpunk box sets": CATEGORY_BY_ID[1672],
  "cpk set": CATEGORY_BY_ID[1663],
};

/** Langues proposées pour chaque produit scellé (Cardmarket ne distingue pas la langue au niveau produit). */
export const SEALED_LANGUAGES = ["en", "fr"] as const;

export function sealedExternalId(idProduct: number, language = "en") {
  return language === "en" ? `cardmarket:${idProduct}` : `cardmarket:${idProduct}:${language}`;
}

/** Id produit Cardmarket d'un externalId scellé (`cardmarket:123` ou `cardmarket:123:fr`). */
export function sealedProductId(externalId: string) {
  if (!externalId.startsWith("cardmarket:")) return null;
  const id = Number(externalId.slice("cardmarket:".length).split(":")[0]);
  return Number.isInteger(id) ? id : null;
}

export function sealedCategoryFor(product: Pick<SealedProduct, "idCategory" | "categoryName">): SealedCategory {
  if (product.idCategory != null && CATEGORY_BY_ID[product.idCategory]) {
    return CATEGORY_BY_ID[product.idCategory];
  }
  const byName = CATEGORY_BY_NAME[normalizeText(product.categoryName)];
  if (byName) return byName;
  return { code: "sealed-other", name: "Produits scellés", sortOrder: 990, cardType: "Sealed" };
}

export function parseSealedProducts(data: unknown): SealedProduct[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { products?: unknown[] }).products)
      ? (data as { products: unknown[] }).products
      : null;
  if (!rows) throw new Error("Catalogue produits scellés / lots illisible.");
  const products: SealedProduct[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const idProduct = readInt(record.idProduct ?? record.idproduct);
    const name = readText(record.name ?? record.Name ?? record.enName);
    const categoryName = readText(record.categoryName ?? record.Category) ?? "Sealed";
    if (idProduct == null || !name) continue;
    products.push({
      idProduct,
      name,
      categoryName,
      idCategory: readInt(record.idCategory ?? record["Category ID"]),
      idExpansion: readInt(record.idExpansion ?? record["Expansion ID"]),
    });
  }
  return products;
}

export function parseSealedProductFile(text: string) {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  return parseSealedProducts(JSON.parse(trimmed) as unknown);
}

function readInt(value: unknown) {
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

function readText(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

export function slugifySealed(name: string, idProduct: number) {
  const base = normalizeText(name).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `cm-${base || "product"}-${idProduct}`.slice(0, 80);
}
