import { normalizeText } from "../cards/search";
import type { CardmarketProduct } from "./types";

export const EXPANSION_ALIASES: Record<string, string> = {
  "the heist demo deck": "merc demo deck",
  "embracing power demo deck": "arasaka demo deck",
};

/**
 * Extensions Cardmarket reliées d'office à une extension du catalogue, quand la ressemblance des noms ne suffit
 * pas : « Set 1 Promos » compte une promo absente de netdeck (« Jackie & V »), sous le seuil de 80 % de noms connus.
 * Les produits de ces extensions absents du catalogue y sont ajoutés par l'import des prix (`cardmarket-promos.ts`).
 */
export const EXPANSION_SET_BY_ID: Readonly<Record<string, string>> = { "id:6719": "PRM01" };

/** Fautes d'orthographe des noms Cardmarket, ramenées au nom du catalogue (clé normalisée → clé normalisée). */
const PRODUCT_NAME_FIXES: Readonly<Record<string, string>> = { "tetratonic rippler": "tetratronic rippler" };

export function productNameKey(name: string) {
  const key = normalizeText(name.replace(/\(\s*v\.?\s*\d+\s*\)/gi, " "));
  return PRODUCT_NAME_FIXES[key] ?? key;
}

export function expansionKey(product: Pick<CardmarketProduct, "idExpansion" | "expansionName" | "idProduct">) {
  if (product.idExpansion != null) return `id:${product.idExpansion}`;
  if (product.expansionName) return `name:${normalizeText(product.expansionName)}`;
  return `product:${product.idProduct}`;
}
