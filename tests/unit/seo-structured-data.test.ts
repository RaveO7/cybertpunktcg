import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ShopDetail } from "../../src/lib/shops/shops";
import {
  breadcrumbLd,
  cardLd,
  eventLd,
  itemListLd,
  organizationLd,
  parseOpeningHours,
  serializeJsonLd,
  storeLd,
  websiteLd,
} from "../../src/lib/seo/structured-data";
import type { PublicTournamentDetail } from "../../src/lib/tournament/public-view";

process.env.APP_URL = "https://tcgtracker.test";

function tournament(overrides: Partial<PublicTournamentDetail> = {}): PublicTournamentDetail {
  return {
    id: "t1",
    name: "Night City Open",
    status: "inscriptions",
    startsAt: "2026-11-14T13:00:00.000Z",
    timeZone: "Europe/Paris",
    venueName: "Arasaka Games",
    city: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    country: "FR",
    lat: 45.76,
    lng: 4.83,
    format: "boutique",
    matchType: "bo1",
    entryFeeCents: 500,
    currency: "EUR",
    maxPlayers: 16,
    playerCount: 4,
    waitlistCount: 0,
    seatsLeft: 12,
    registrationOpen: true,
    shop: { slug: "arasaka-games", name: "Arasaka Games", verified: true, logoUrl: null },
    distanceKm: null,
    place: {
      venueName: "Arasaka Games",
      address: "1 rue de la République",
      postalCode: "69001",
      city: "Lyon",
      region: "Auvergne-Rhône-Alpes",
      country: "FR",
      lat: 45.76,
      lng: 4.83,
    },
    description: "Tournoi mensuel.",
    prizes: null,
    swissRounds: 3,
    roundMinutes: 50,
    requireApproval: false,
    organizerName: "Jo",
    championName: null,
    standings: null,
    ...overrides,
  };
}

function shop(overrides: Partial<ShopDetail> = {}): ShopDetail {
  return {
    id: "s1",
    slug: "arasaka-games",
    name: "Arasaka Games",
    city: "Lyon",
    region: null,
    country: "FR",
    lat: 45.76,
    lng: 4.83,
    verified: true,
    logoUrl: null,
    distanceKm: null,
    description: null,
    website: null,
    socials: [],
    phone: null,
    contactEmail: null,
    hours: null,
    place: { venueName: null, address: "1 rue X", postalCode: null, city: "Lyon", region: null, country: "FR", lat: 45.76, lng: 4.83 },
    ...overrides,
  };
}

describe("seo : données structurées", () => {
  it("échappe un nom piégé pour ne jamais fermer la balise script", () => {
    const json = serializeJsonLd(eventLd(tournament({ name: "</script><script>alert(1)</script>" }), "fr"));
    assert.ok(!json.includes("</script>"));
    assert.ok(!json.includes("<"));
    assert.equal((JSON.parse(json) as { name: string }).name, "</script><script>alert(1)</script>");
  });

  it("événement : statut, lieu, organisateur et offre", () => {
    const ld = eventLd(tournament(), "en");
    assert.equal(ld["@type"], "Event");
    assert.equal(ld.url, "https://tcgtracker.test/en/tournaments/t1");
    assert.equal(ld.eventStatus, "https://schema.org/EventScheduled");
    assert.equal(ld.eventAttendanceMode, "https://schema.org/OfflineEventAttendanceMode");
    assert.deepEqual((ld.organizer as { url: string }).url, "https://tcgtracker.test/en/shops/arasaka-games");
    const offers = ld.offers as { price: string; availability: string };
    assert.equal(offers.price, "5.00");
    assert.equal(offers.availability, "https://schema.org/InStock");
    assert.equal((ld.location as { address: { postalCode: string } }).address.postalCode, "69001");
  });

  it("tournoi complet → épuisé, gratuit → prix 0, annulé → EventCancelled", () => {
    assert.equal((eventLd(tournament({ seatsLeft: 0 }), "fr").offers as { availability: string }).availability, "https://schema.org/SoldOut");
    assert.equal((eventLd(tournament({ entryFeeCents: null }), "fr").offers as { price: string }).price, "0");
    assert.equal(eventLd(tournament({ status: "annule" }), "fr").eventStatus, "https://schema.org/EventCancelled");
  });

  it("boutique sans horaires ni logo : propriétés omises", () => {
    const ld = storeLd(shop(), "fr");
    assert.equal(ld["@type"], "Store");
    for (const key of ["openingHoursSpecification", "logo", "telephone", "sameAs", "description"]) assert.ok(!(key in ld), key);
  });

  it("boutique complète : logo absolu, réseaux et horaires reconnus", () => {
    const ld = storeLd(
      shop({
        logoUrl: "/api/shops/arasaka-games/logo?v=1",
        website: "https://arasaka.example.com",
        socials: [{ kind: "instagram", url: "https://instagram.com/arasaka" }],
        phone: "04 00 00 00 00",
        hours: "Mar–Sam 10h–19h\nDim 14h-18h30",
      }),
      "fr",
    );
    assert.equal(ld.logo, "https://tcgtracker.test/api/shops/arasaka-games/logo?v=1");
    assert.deepEqual(ld.sameAs, ["https://arasaka.example.com", "https://instagram.com/arasaka"]);
    assert.equal((ld.openingHoursSpecification as unknown[]).length, 2);
  });

  it("reconnaît les horaires usuels et ignore le texte libre", () => {
    assert.deepEqual(parseOpeningHours("Tue-Sat 10am-7pm"), [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "10:00",
        closes: "19:00",
      },
    ]);
    assert.deepEqual(parseOpeningHours("Lun 14h30 - 19h")[0], {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday"],
      opens: "14:30",
      closes: "19:00",
    });
    assert.deepEqual(parseOpeningHours("Ouvert presque tout le temps"), []);
  });

  it("organisation sans réseau : pas de sameAs", () => {
    assert.ok(!("sameAs" in organizationLd([{ href: "" }])));
    assert.deepEqual(organizationLd([{ href: "https://discord.gg/x" }, { href: "" }]).sameAs, ["https://discord.gg/x"]);
  });

  it("site, fil d'Ariane et liste", () => {
    assert.equal(websiteLd("en").url, "https://tcgtracker.test/en");
    const crumbs = breadcrumbLd([
      { name: "Accueil", path: "/" },
      { name: "Cartes", path: "/cartes" },
    ]);
    assert.deepEqual((crumbs.itemListElement as { position: number; item: string }[]).map((c) => [c.position, c.item]), [
      [1, "https://tcgtracker.test/"],
      [2, "https://tcgtracker.test/cartes"],
    ]);
    assert.equal(itemListLd([]), null);
  });

  it("carte : illustrateur absent → pas d'auteur", () => {
    const ld = cardLd({ name: "V", slug: "v-streetkid", description: "Texte", image: "/card-images/v.webp", artist: null }, "fr");
    assert.ok(!("author" in ld));
    assert.equal(ld.image, "https://tcgtracker.test/card-images/v.webp");
    assert.equal(ld.url, "https://tcgtracker.test/cartes/v-streetkid");
  });
});
