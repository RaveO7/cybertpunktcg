/**
 * Tournois publics, logique pure : places et liste d'attente, classement sans la liste
 * d'attente, fichier calendrier, tri de l'annuaire, filtres d'URL.
 * Cf. specs/tournaments/capacity, public-listing, discovery.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { directoryQuerySchema, placeSchema, shopReviewSchema, tournamentListingFields, validate } from "../../src/lib/api-schemas";
import { z } from "zod";
import { isFull, playersToPromote, seatsTaken, waitlist, waitlistPosition } from "../../src/lib/tournament/capacity";
import { estimatedEnd, tournamentIcs } from "../../src/lib/tournament/calendar";
import { sortSummaries } from "../../src/lib/tournament/directory";
import type { PublicTournamentSummary } from "../../src/lib/tournament/public-view";
import { computeStandings } from "../../src/lib/tournament/standings";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 12, 10, minutes));
const player = (id: string, status: string, minutes = 0) => ({ id, status, createdAt: at(minutes) });

describe("places et liste d'attente", () => {
  it("actifs et en attente d'approbation occupent une place", () => {
    const players = [player("a", "active"), player("b", "pending"), player("c", "dropped"), player("d", "waitlist"), player("e", "dq")];
    assert.equal(seatsTaken(players), 2);
    assert.equal(isFull(2, players), true);
    assert.equal(isFull(3, players), false);
    assert.equal(isFull(null, players), false, "sans limite : jamais complet");
  });

  it("ordre de la liste d'attente = ordre d'inscription", () => {
    const players = [player("late", "waitlist", 5), player("first", "waitlist", 1), player("a", "active")];
    assert.deepEqual(waitlist(players).map((p) => p.id), ["first", "late"]);
    assert.equal(waitlistPosition(players, "late"), 2);
    assert.equal(waitlistPosition(players, "a"), null);
  });

  it("promotion : autant que de places libres, dans l'ordre", () => {
    const players = [
      ...Array.from({ length: 16 }, (_, i) => player(`p${i}`, "active")),
      player("w1", "waitlist", 1),
      player("w2", "waitlist", 2),
      player("w3", "waitlist", 3),
    ];
    assert.deepEqual(playersToPromote(16, players), []);
    assert.deepEqual(playersToPromote(18, players).map((p) => p.id), ["w1", "w2"]);
    assert.deepEqual(playersToPromote(10, players), [], "limite sous les inscrits : personne n'est promu ni rétrogradé");
  });

  it("le classement ignore la liste d'attente", () => {
    const standings = computeStandings(
      [
        { id: "a", name: "A", status: "active", missedRounds: 0 },
        { id: "w", name: "W", status: "waitlist", missedRounds: 0 },
      ],
      [],
    );
    assert.deepEqual(standings.map((row) => row.playerId), ["a"]);
  });
});

describe("fichier calendrier", () => {
  it("début, fin estimée, lieu et lien", () => {
    const start = new Date("2026-10-17T12:00:00Z");
    assert.equal(estimatedEnd(start, 3, 50).toISOString(), "2026-10-17T15:15:00.000Z");
    const ics = tournamentIcs({
      id: "t1",
      name: "Night City Brawl, édition 2",
      startsAt: start,
      swissRounds: 3,
      roundMinutes: 50,
      location: "Arasaka Games, 12 Rue de la République, 69002 Lyon, FR",
      url: "https://example.com/tournois/publics/t1",
      now: new Date("2026-10-12T00:00:00Z"),
    });
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /DTSTART:20261017T120000Z\r\n/);
    assert.match(ics, /DTEND:20261017T151500Z\r\n/);
    assert.match(ics, /SUMMARY:Night City Brawl\\, édition 2\r\n/);
    assert.match(ics, /URL:https:\/\/example.com\/tournois\/publics\/t1\r\n/);
    for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `ligne trop longue : ${line}`);
  });
});

function summary(id: string, startsAt: string, verified: boolean, distanceKm: number | null = null): PublicTournamentSummary {
  return {
    id,
    name: id,
    status: "inscriptions",
    startsAt,
    timeZone: null,
    venueName: null,
    city: "Lyon",
    region: null,
    country: "FR",
    lat: 45.7,
    lng: 4.8,
    format: "boutique",
    matchType: "bo3",
    entryFeeCents: null,
    currency: "EUR",
    maxPlayers: null,
    playerCount: 0,
    waitlistCount: 0,
    seatsLeft: null,
    registrationOpen: true,
    shop: verified ? { slug: "s", name: "S", verified: true, logoUrl: null } : null,
    distanceKm,
  };
}

describe("tri de l'annuaire", () => {
  it("par date, boutique vérifiée d'abord à même heure", () => {
    const rows = [summary("b", "2026-10-20T10:00:00Z", false), summary("a", "2026-10-20T10:00:00Z", true), summary("c", "2026-10-19T10:00:00Z", false)];
    assert.deepEqual(sortSummaries(rows, "date").map((row) => row.id), ["c", "a", "b"]);
  });

  it("par distance", () => {
    const rows = [summary("far", "2026-10-19T10:00:00Z", false, 40), summary("near", "2026-10-25T10:00:00Z", false, 3)];
    assert.deepEqual(sortSummaries(rows, "distance").map((row) => row.id), ["near", "far"]);
  });
});

describe("validation", () => {
  it("filtres d'URL : rayon parmi les valeurs proposées, point complet", () => {
    const ok = validate(directoryQuerySchema, { lat: "45.76", lng: "4.83", radius: "25", seats: "1", price: "free" });
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.deepEqual(ok.data.near, { lat: 45.76, lng: 4.83, radiusKm: 25 });
      assert.equal(ok.data.seats, true);
    }
    assert.equal(validate(directoryQuerySchema, { lat: "45", lng: "4", radius: "30" }).ok, false);
    assert.equal(validate(directoryQuerySchema, { lat: "45" }).ok, false);
    assert.equal(validate(directoryQuerySchema, { format: "" }).ok, true, "paramètre vide ignoré");
  });

  it("lieu sans coordonnées refusé", () => {
    assert.equal(validate(placeSchema, { address: "1 rue", city: "Lyon", country: "FR" }).ok, false);
    assert.equal(validate(placeSchema, { address: "1 rue", city: "Lyon", country: "fr", lat: 45, lng: 4 }).ok, true);
  });

  it("description limitée à 2000 caractères, lots à 500", () => {
    const listing = z.object(tournamentListingFields);
    assert.equal(validate(listing, { description: "x".repeat(2500) }).ok, false);
    assert.equal(validate(listing, { description: "x".repeat(2000), prizes: "y".repeat(500) }).ok, true);
    assert.equal(validate(listing, { prizes: "y".repeat(501) }).ok, false);
  });

  it("refus d'une boutique : motif obligatoire", () => {
    assert.equal(validate(shopReviewSchema, { decision: "reject" }).ok, false);
    assert.equal(validate(shopReviewSchema, { decision: "reject", note: "Adresse fictive" }).ok, true);
    assert.equal(validate(shopReviewSchema, { decision: "verify" }).ok, true);
  });
});
