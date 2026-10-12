/**
 * Géolocalisation : distance, boîte englobante, lieu normalisé, géocodage (IGN / Nominatim
 * simulés), cache et indisponibilité. Cf. specs/locations/geocoding.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { boundingBox, haversineKm, roundDistanceKm } from "../../src/lib/geo/distance";
import { createGeocoder, GeocodeUnavailableError, type GeocoderDeps } from "../../src/lib/geo/geocode";
import { cityKey, normalizePlace, placeFromRow } from "../../src/lib/geo/location";

const PARIS = { lat: 48.8566, lng: 2.3522 };
const LYON = { lat: 45.764, lng: 4.8357 };

describe("distance", () => {
  it("Paris – Lyon ≈ 392 km à vol d'oiseau", () => {
    const km = haversineKm(PARIS, LYON);
    assert.ok(Math.abs(km - 392) < 3, `distance obtenue : ${km}`);
    assert.equal(haversineKm(PARIS, PARIS), 0);
  });

  it("arrondi d'affichage : dixième sous 10 km, kilomètre au-delà", () => {
    assert.equal(roundDistanceKm(3.14159), 3.1);
    assert.equal(roundDistanceKm(9.96), 10);
    assert.equal(roundDistanceKm(42.6), 43);
  });

  it("la boîte englobante contient tout le disque", () => {
    const box = boundingBox(PARIS, 25);
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (bearing * Math.PI) / 180;
      // Point à ~24,9 km dans cette direction.
      const point = {
        lat: PARIS.lat + (24.9 / 111.32) * Math.cos(rad),
        lng: PARIS.lng + (24.9 / (111.32 * Math.cos((PARIS.lat * Math.PI) / 180))) * Math.sin(rad),
      };
      assert.ok(haversineKm(PARIS, point) <= 25.2);
      assert.ok(point.lat >= box.minLat && point.lat <= box.maxLat && point.lng >= box.minLng && point.lng <= box.maxLng);
    }
  });

  it("près de l'antiméridien, la longitude n'est pas bornée", () => {
    const box = boundingBox({ lat: -17.7, lng: 179.9 }, 50);
    assert.equal(box.minLng, -180);
    assert.equal(box.maxLng, 180);
  });
});

describe("lieu normalisé", () => {
  it("clé de ville sans casse, accents ni tirets", () => {
    assert.equal(cityKey("Saint-Étienne"), "saint etienne");
    assert.equal(cityKey("  L'Haÿ-les-Roses "), "l hay les roses");
  });

  it("refuse un lieu sans pays, ville ou coordonnées", () => {
    const base = { address: "1 rue A", city: "Lyon", country: "FR", lat: 45.7, lng: 4.8 };
    assert.ok(normalizePlace(base));
    assert.equal(normalizePlace({ ...base, lat: undefined }), null);
    assert.equal(normalizePlace({ ...base, country: "France" }), null);
    assert.equal(normalizePlace({ ...base, city: " " }), null);
    assert.equal(normalizePlace({ ...base, lat: 120 }), null);
    assert.equal(normalizePlace({ ...base, country: "fr" })?.country, "FR");
  });

  it("une ligne sans coordonnées n'a pas de lieu", () => {
    const row = { venueName: null, address: "1 rue A", postalCode: null, city: "Lyon", region: null, country: "FR", lat: null, lng: 4.8 };
    assert.equal(placeFromRow(row), null);
  });
});

const IGN_REPONSE = {
  features: [
    {
      geometry: { coordinates: [4.8357, 45.764] },
      properties: {
        label: "12 Rue de la République 69002 Lyon",
        name: "12 Rue de la République",
        postcode: "69002",
        city: "Lyon",
        context: "69, Rhône, Auvergne-Rhône-Alpes",
        type: "housenumber",
      },
    },
  ],
};

function fakeDeps(responses: (url: URL) => unknown, overrides: Partial<GeocoderDeps> = {}) {
  const calls: URL[] = [];
  const store = new Map<string, string>();
  const deps: GeocoderDeps = {
    fetch: (async (input: URL) => {
      calls.push(input);
      const body = responses(input);
      if (body instanceof Error) throw body;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch,
    cache: { get: async (key) => store.get(key) ?? null, set: async (key, value) => void store.set(key, value) },
    acquireNominatimSlot: async () => true,
    userAgent: "test",
    ...overrides,
  };
  return { deps, calls, store };
}

describe("géocodage", () => {
  it("France : suggestions IGN dès 3 caractères, lieu complet", async () => {
    const { deps, calls } = fakeDeps(() => IGN_REPONSE);
    const geocoder = createGeocoder(deps);
    assert.deepEqual(await geocoder.suggestAddresses("12", "FR"), [], "moins de 3 caractères : aucun appel");
    const [first] = await geocoder.suggestAddresses("12 rue de la Ré", "FR");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].hostname, "data.geopf.fr");
    assert.equal(calls[0].searchParams.get("autocomplete"), "1");
    assert.equal(first.city, "Lyon");
    assert.equal(first.postalCode, "69002");
    assert.equal(first.region, "Auvergne-Rhône-Alpes");
    assert.equal(first.country, "FR");
    assert.equal(first.lat, 45.764);
  });

  it("hors France : pas d'autocomplétion", async () => {
    const { deps, calls } = fakeDeps(() => []);
    assert.deepEqual(await createGeocoder(deps).suggestAddresses("Rue Neuve 1", "BE"), []);
    assert.equal(calls.length, 0);
  });

  it("hors France : un seul appel Nominatim structuré, avec User-Agent", async () => {
    const seen: RequestInit[] = [];
    const { deps, calls } = fakeDeps(() => [
      {
        lat: "50.8503",
        lon: "4.3517",
        display_name: "Rue Neuve 1, Bruxelles",
        address: { road: "Rue Neuve", house_number: "1", postcode: "1000", city: "Bruxelles", state: "Bruxelles-Capitale", country_code: "be" },
      },
    ]);
    const baseFetch = deps.fetch;
    deps.fetch = (async (input: URL, init: RequestInit) => {
      seen.push(init);
      return baseFetch(input, init);
    }) as typeof fetch;
    const place = await createGeocoder(deps).resolveAddress({ street: "Rue Neuve 1", postalCode: "1000", city: "Bruxelles" }, "BE");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].hostname, "nominatim.openstreetmap.org");
    assert.equal(calls[0].searchParams.get("countrycodes"), "be");
    assert.equal((seen[0].headers as Record<string, string>)["user-agent"], "test");
    assert.equal(place?.city, "Bruxelles");
    assert.equal(place?.address, "1 Rue Neuve");
    assert.equal(place?.country, "BE");
  });

  it("adresse introuvable : null", async () => {
    const { deps } = fakeDeps(() => []);
    assert.equal(await createGeocoder(deps).resolveAddress({ street: "Nulle part", city: "Xyz" }, "DE"), null);
  });

  it("résultat dans un autre pays : ignoré", async () => {
    const { deps } = fakeDeps(() => [{ lat: "1", lon: "2", address: { city: "Lille", country_code: "fr" } }]);
    assert.equal(await createGeocoder(deps).resolveAddress({ street: "Rue", city: "Lille" }, "BE"), null);
  });

  it("cache : la même recherche n'appelle le service qu'une fois", async () => {
    const { deps, calls } = fakeDeps(() => IGN_REPONSE);
    const geocoder = createGeocoder(deps);
    await geocoder.suggestAddresses("12 rue de la Ré", "FR");
    await geocoder.suggestAddresses("  12 RUE de la ré ", "FR");
    assert.equal(calls.length, 1);
  });

  it("service indisponible ou saturé : erreur « réessayez »", async () => {
    const down = fakeDeps(() => new Error("ECONNRESET"));
    await assert.rejects(createGeocoder(down.deps).suggestAddresses("12 rue", "FR"), GeocodeUnavailableError);
    const busy = fakeDeps(() => [], { acquireNominatimSlot: async () => false });
    await assert.rejects(createGeocoder(busy.deps).resolveAddress({ street: "A", city: "B" }, "BE"), GeocodeUnavailableError);
    assert.equal(busy.calls.length, 0, "aucun appel au-delà d'une requête par seconde");
  });

  it("communes françaises pour la recherche « autour de »", async () => {
    const { deps, calls } = fakeDeps(() => ({
      features: [{ geometry: { coordinates: [2.35, 48.85] }, properties: { city: "Paris", name: "Paris", context: "75, Paris, Île-de-France", type: "municipality" } }],
    }));
    const [paris] = await createGeocoder(deps).suggestFrenchCities("Par");
    assert.equal(calls[0].searchParams.get("type"), "municipality");
    assert.equal(paris.city, "Paris");
    assert.equal(paris.region, "Île-de-France");
  });
});
