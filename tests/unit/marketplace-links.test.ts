import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { marketplaceLinks } from "../../src/lib/marketplace-links";
import type { CardDTO, PrintingDTO } from "../../src/lib/types";

const card = { canonicalName: "Johnny Silverhand", name: "Johnny Silverhand" } as CardDTO;
const printing = { externalId: "WNC-001-fr", localizedName: "Johnny Silverhand FR" } as PrintingDTO;

function byId(links: ReturnType<typeof marketplaceLinks>, id: string) {
  return links.find((link) => link.id === id);
}

describe("marketplaceLinks", () => {
  it("sans identifiants : eBay sans suivi, CardNexus en recherche directe, rien de sponsorisé", () => {
    const links = marketplaceLinks(card, printing, "fr", {});
    const ebay = new URL(byId(links, "ebay")!.href);
    assert.equal(ebay.host, "www.ebay.fr");
    assert.equal(ebay.searchParams.get("_nkw"), "Johnny Silverhand FR Cyberpunk TCG");
    assert.equal(ebay.searchParams.get("campid"), null);
    const cardnexus = new URL(byId(links, "cardnexus")!.href);
    assert.equal(cardnexus.origin + cardnexus.pathname, "https://cardnexus.com/fr/search");
    assert.equal(cardnexus.searchParams.get("game"), "cyberpunk");
    assert.equal(cardnexus.searchParams.get("q"), "Johnny Silverhand");
    assert.ok(links.every((link) => !link.sponsored));
  });

  it("eBay porte la campagne EPN et la rotation du site de la langue", () => {
    const links = marketplaceLinks(card, printing, "de", { ebayCampaignId: " 5338000000 " });
    const ebay = byId(links, "ebay")!;
    const url = new URL(ebay.href);
    assert.equal(url.host, "www.ebay.de");
    assert.equal(url.searchParams.get("campid"), "5338000000");
    assert.equal(url.searchParams.get("mkrid"), "707-53477-19255-0");
    assert.equal(url.searchParams.get("mkcid"), "1");
    assert.equal(url.searchParams.get("mkevt"), "1");
    assert.equal(url.searchParams.get("customid"), "WNC-001-fr");
    assert.equal(ebay.sponsored, true);
  });

  it("langue sans site eBay dédié : ebay.com et rotation US", () => {
    const url = new URL(byId(marketplaceLinks(card, printing, "en", { ebayCampaignId: "1" }), "ebay")!.href);
    assert.equal(url.host, "www.ebay.com");
    assert.equal(url.searchParams.get("mkrid"), "711-53200-19255-0");
  });

  it("CardNexus sans langue dédiée : version anglaise", () => {
    const url = new URL(byId(marketplaceLinks(card, printing, "de", {}), "cardnexus")!.href);
    assert.equal(url.pathname, "/en/search");
  });

  it("CardNexus : lien d'affiliation avec le nom anglais, juste après eBay", () => {
    const links = marketplaceLinks(card, printing, "fr", { cardnexusPartnerId: "1111" });
    const cardnexus = byId(links, "cardnexus")!;
    assert.equal(cardnexus.href, "https://af.cardnexus.link/1111/Johnny%20Silverhand");
    assert.equal(cardnexus.sponsored, true);
    assert.deepEqual(links.map((link) => link.id), ["cardmarket", "ebay", "cardnexus", "leboncoin", "vinted"]);
  });
});
