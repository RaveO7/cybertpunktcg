// Liens de recherche vers les sites de revente (pas d'API : l'utilisateur atterrit sur la recherche du site).
// eBay et CardNexus portent nos identifiants d'affiliation quand ils sont configurés.
import type { CardDTO, PrintingDTO } from "./types";
import { printingTitle } from "./logic";

export type MarketplaceLink = {
  id: "cardmarket" | "ebay" | "cardnexus" | "leboncoin" | "vinted";
  label: string;
  href: string;
  /** Lien d'affiliation : à marquer `rel="sponsored"`. */
  sponsored: boolean;
};

export type AffiliateConfig = {
  /** Identifiant de campagne eBay Partner Network (`campid`). */
  ebayCampaignId?: string | null;
  /** Identifiant partenaire CardNexus (`mpId` des liens af.cardnexus.link). */
  cardnexusPartnerId?: string | null;
};

const ENV_AFFILIATES: AffiliateConfig = {
  ebayCampaignId: process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID,
  cardnexusPartnerId: process.env.NEXT_PUBLIC_CARDNEXUS_PARTNER_ID,
};

const CARDMARKET_LOCALES = new Set(["fr", "en", "de", "es", "it"]);
// CardNexus n'est traduit qu'en français et en anglais.
const CARDNEXUS_LOCALES = new Set(["fr", "en"]);
const VINTED_HOSTS: Record<string, string> = { fr: "www.vinted.fr", de: "www.vinted.de", es: "www.vinted.es", it: "www.vinted.it" };
// Site eBay et identifiant de rotation EPN par langue (developer.ebay.com/api-docs/buy/static/ref-epn-link.html).
const EBAY_SITES: Record<string, { host: string; rotation: string }> = {
  fr: { host: "www.ebay.fr", rotation: "709-53476-19255-0" },
  de: { host: "www.ebay.de", rotation: "707-53477-19255-0" },
  es: { host: "www.ebay.es", rotation: "1185-53479-19255-0" },
  it: { host: "www.ebay.it", rotation: "724-53478-19255-0" },
};
const EBAY_DEFAULT = { host: "www.ebay.com", rotation: "711-53200-19255-0" };

/** Ajoute le nom du jeu pour les sites généralistes, sauf s'il figure déjà (produits scellés). */
function withGame(name: string) {
  return /cyberpunk/i.test(name) ? name : `${name} Cyberpunk TCG`;
}

function ebayHref(query: string, locale: string, campaignId: string | undefined, subId: string) {
  const site = EBAY_SITES[locale] ?? EBAY_DEFAULT;
  const params = new URLSearchParams({ _nkw: query });
  if (campaignId) {
    params.set("mkevt", "1");
    params.set("mkcid", "1");
    params.set("mkrid", site.rotation);
    params.set("campid", campaignId);
    params.set("toolid", "10001");
    params.set("customid", subId);
  }
  return `https://${site.host}/sch/i.html?${params}`;
}

export function marketplaceLinks(
  card: CardDTO | undefined,
  printing: PrintingDTO,
  locale: string,
  affiliates: AffiliateConfig = ENV_AFFILIATES,
): MarketplaceLink[] {
  // Cardmarket et CardNexus indexent les noms anglais ; les autres sites, le nom tel qu'imprimé.
  const englishName = card?.canonicalName || card?.name || printingTitle(card, printing);
  const query = withGame(printingTitle(card, printing));
  const cardmarketLocale = CARDMARKET_LOCALES.has(locale) ? locale : "en";
  const encoded = encodeURIComponent(query);
  const ebayCampaignId = affiliates.ebayCampaignId?.trim() || undefined;
  const cardnexusPartnerId = affiliates.cardnexusPartnerId?.trim() || undefined;

  const links: MarketplaceLink[] = [
    {
      id: "cardmarket",
      label: "Cardmarket",
      href: `https://www.cardmarket.com/${cardmarketLocale}/Cyberpunk/Products/Search?searchString=${encodeURIComponent(englishName)}`,
      sponsored: false,
    },
    {
      id: "ebay",
      label: "eBay",
      // customid : retrouver dans le tableau de bord EPN quelle impression a généré la vente.
      href: ebayHref(query, locale, ebayCampaignId, printing.externalId),
      sponsored: Boolean(ebayCampaignId),
    },
  ];
  // Sans identifiant partenaire, recherche directe dans la section Cyberpunk de CardNexus.
  const cardnexusLocale = CARDNEXUS_LOCALES.has(locale) ? locale : "en";
  links.push({
    id: "cardnexus",
    label: "CardNexus",
    href: cardnexusPartnerId
      ? `https://af.cardnexus.link/${encodeURIComponent(cardnexusPartnerId)}/${encodeURIComponent(englishName)}`
      : `https://cardnexus.com/${cardnexusLocale}/search?${new URLSearchParams({ game: "cyberpunk", q: englishName })}`,
    sponsored: Boolean(cardnexusPartnerId),
  });
  links.push(
    { id: "leboncoin", label: "Leboncoin", href: `https://www.leboncoin.fr/recherche?text=${encoded}`, sponsored: false },
    { id: "vinted", label: "Vinted", href: `https://${VINTED_HOSTS[locale] ?? "www.vinted.com"}/catalog?search_text=${encoded}`, sponsored: false },
  );
  return links;
}
