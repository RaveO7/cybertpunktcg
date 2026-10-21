// Liens de recherche vers les sites de revente (pas d'API : l'utilisateur atterrit sur la recherche du site).
import type { CardDTO, PrintingDTO } from "./types";
import { printingTitle } from "./logic";

export type MarketplaceLink = { id: "cardmarket" | "ebay" | "leboncoin" | "vinted"; label: string; href: string };

const CARDMARKET_LOCALES = new Set(["fr", "en", "de", "es", "it"]);
const EBAY_HOSTS: Record<string, string> = { fr: "www.ebay.fr", de: "www.ebay.de", es: "www.ebay.es", it: "www.ebay.it" };
const VINTED_HOSTS: Record<string, string> = { fr: "www.vinted.fr", de: "www.vinted.de", es: "www.vinted.es", it: "www.vinted.it" };

/** Ajoute le nom du jeu pour les sites généralistes, sauf s'il figure déjà (produits scellés). */
function withGame(name: string) {
  return /cyberpunk/i.test(name) ? name : `${name} Cyberpunk TCG`;
}

export function marketplaceLinks(card: CardDTO | undefined, printing: PrintingDTO, locale: string): MarketplaceLink[] {
  // Cardmarket indexe les noms anglais ; les autres sites, le nom tel qu'imprimé.
  const englishName = card?.canonicalName || card?.name || printingTitle(card, printing);
  const query = withGame(printingTitle(card, printing));
  const cardmarketLocale = CARDMARKET_LOCALES.has(locale) ? locale : "en";
  const encoded = encodeURIComponent(query);
  return [
    {
      id: "cardmarket",
      label: "Cardmarket",
      href: `https://www.cardmarket.com/${cardmarketLocale}/Cyberpunk/Products/Search?searchString=${encodeURIComponent(englishName)}`,
    },
    { id: "ebay", label: "eBay", href: `https://${EBAY_HOSTS[locale] ?? "www.ebay.com"}/sch/i.html?_nkw=${encoded}` },
    { id: "leboncoin", label: "Leboncoin", href: `https://www.leboncoin.fr/recherche?text=${encoded}` },
    { id: "vinted", label: "Vinted", href: `https://${VINTED_HOSTS[locale] ?? "www.vinted.com"}/catalog?search_text=${encoded}` },
  ];
}
