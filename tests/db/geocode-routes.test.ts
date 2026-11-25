/**
 * Routes de géocodage (cities, suggest, resolve) : session, validation, limite de débit, erreurs du service.
 * Le géocodeur et les villes connues sont simulés (vi.mock) : aucun appel réseau. Travaille sur une COPIE
 * de la base SQLite ; comptes de test supprimés dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";

const mocks = vi.hoisted(() => ({
  suggestFrenchCities: vi.fn(),
  suggestAddresses: vi.fn(),
  resolveAddress: vi.fn(),
  knownCities: vi.fn(),
}));

vi.mock("@/lib/geo/server", () => ({
  geocoder: {
    suggestFrenchCities: mocks.suggestFrenchCities,
    suggestAddresses: mocks.suggestAddresses,
    resolveAddress: mocks.resolveAddress,
  },
  knownCities: mocks.knownCities,
}));

type Prisma = typeof import("../../src/lib/prisma").prisma;

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const savedTrustProxy = process.env.TRUST_PROXY;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let cities: typeof import("../../src/app/api/geocode/cities/route");
let suggest: typeof import("../../src/app/api/geocode/suggest/route");
let resolve: typeof import("../../src/app/api/geocode/resolve/route");
let sessionCookie: string;
let user: { id: string; token: string };
const userIds: string[] = [];
let ipCounter = 0;

// Une IP par appel : la limite de débit (par IP) ne gêne pas les autres cas.
function request(path: string, init: { method?: string; body?: unknown; signedIn?: boolean; ip?: string } = {}) {
  const headers = new Headers({ "x-forwarded-for": init.ip ?? `10.0.0.${++ipCounter}` });
  if (init.signedIn !== false) headers.set("cookie", `${sessionCookie}=${encodeURIComponent(user.token)}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://127.0.0.1${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

beforeAll(async () => {
  process.env.TRUST_PROXY = "1";
  db = await openDatabaseCopy("cptcg-geocode-routes-");
  prisma = db.prisma;
  cities = await import("../../src/app/api/geocode/cities/route");
  suggest = await import("../../src/app/api/geocode/suggest/route");
  resolve = await import("../../src/app/api/geocode/resolve/route");
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;
  const created = await auth.registerAccount({
    email: `geocode.routes.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Geocode routes",
  });
  userIds.push(created.id);
  user = { id: created.id, token: (await auth.createSession(created.id)).token };
});

afterAll(async () => {
  try {
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    if (savedTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = savedTrustProxy;
    await db?.cleanup();
  }
});

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.knownCities.mockResolvedValue([]);
  mocks.suggestFrenchCities.mockResolvedValue([]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("aucun appel réseau autorisé");
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lyon = { city: "Lyon", region: "Auvergne-Rhône-Alpes", country: "FR", lat: 45.76, lng: 4.83 };

describe("geocode/cities", () => {
  it("public : villes connues d'abord, communes sans doublon, 10 au plus, requête tronquée à 100", async () => {
    mocks.knownCities.mockResolvedValue([lyon]);
    mocks.suggestFrenchCities.mockResolvedValue([
      { ...lyon, lat: 1, lng: 1 },
      ...Array.from({ length: 12 }, (_, i) => ({ city: `Ville${i}`, region: null, country: "FR", lat: i, lng: i })),
    ]);
    const response = await cities.GET(request(`/api/geocode/cities?q=${"a".repeat(150)}`, { signedIn: false }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as { cities: { city: string; lat: number }[] };
    assert.equal(body.cities.length, 10);
    assert.deepEqual(body.cities[0], lyon);
    assert.equal(body.cities.filter((c) => c.city === "Lyon").length, 1);
    assert.equal(mocks.knownCities.mock.calls[0][0], "a".repeat(100));
  });

  it("service des communes indisponible : les villes connues suffisent", async () => {
    mocks.knownCities.mockResolvedValue([lyon]);
    mocks.suggestFrenchCities.mockRejectedValue(new Error("IGN down"));
    const response = await cities.GET(request("/api/geocode/cities?q=ly", { signedIn: false }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { cities: [lyon] });
  });

  it("limite de débit : 429 avec retry-after à la 31e requête de la même IP", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await cities.GET(request("/api/geocode/cities?q=ly", { signedIn: false, ip }))).status, 200, `appel ${i + 1}`);
    }
    const limited = await cities.GET(request("/api/geocode/cities?q=ly", { signedIn: false, ip }));
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    assert.equal(mocks.knownCities.mock.calls.length, 30);
  });
});

describe("geocode/suggest", () => {
  it("401 sans compte, sans interroger le géocodeur", async () => {
    const response = await suggest.GET(request("/api/geocode/suggest?q=rue", { signedIn: false }));
    assert.equal(response.status, 401);
    assert.equal(mocks.suggestAddresses.mock.calls.length, 0);
  });

  it("400 si le pays est invalide", async () => {
    const response = await suggest.GET(request("/api/geocode/suggest?q=rue&country=ZZZ"));
    assert.equal(response.status, 400);
    assert.equal(mocks.suggestAddresses.mock.calls.length, 0);
  });

  it("succès : pays FR par défaut, pays mis en majuscules, requête tronquée à 200", async () => {
    mocks.suggestAddresses.mockResolvedValue([{ label: "1 rue X, Lyon" }]);
    const first = await suggest.GET(request(`/api/geocode/suggest?q=${"b".repeat(300)}`));
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { suggestions: [{ label: "1 rue X, Lyon" }] });
    assert.deepEqual(mocks.suggestAddresses.mock.calls[0], ["b".repeat(200), "FR"]);
    await suggest.GET(request("/api/geocode/suggest?q=rue&country=fr"));
    assert.equal(mocks.suggestAddresses.mock.calls[1][1], "FR");
  });

  it("service indisponible : 503 avec retry", async () => {
    const { GeocodeUnavailableError } = await import("../../src/lib/geo/geocode");
    mocks.suggestAddresses.mockRejectedValue(new GeocodeUnavailableError());
    const response = await suggest.GET(request("/api/geocode/suggest?q=rue"));
    assert.equal(response.status, 503);
    assert.equal(((await response.json()) as { retry: boolean }).retry, true);
  });

  it("limite de débit : 429 à la 31e requête de la même IP", async () => {
    mocks.suggestAddresses.mockResolvedValue([]);
    const ip = "203.0.113.8";
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await suggest.GET(request("/api/geocode/suggest?q=rue", { ip }))).status, 200, `appel ${i + 1}`);
    }
    assert.equal((await suggest.GET(request("/api/geocode/suggest?q=rue", { ip }))).status, 429);
  });
});

describe("geocode/resolve", () => {
  const valid = { country: "fr", street: "  1 rue de la Paix ", city: "Paris", postalCode: "75002" };

  it("401 sans compte", async () => {
    const response = await resolve.POST(request("/api/geocode/resolve", { method: "POST", body: valid, signedIn: false }));
    assert.equal(response.status, 401);
    assert.equal(mocks.resolveAddress.mock.calls.length, 0);
  });

  it("400 si l'adresse est incomplète ou invalide", async () => {
    for (const body of [{}, { ...valid, street: "  " }, { ...valid, city: "" }, { ...valid, country: "ZZZ" }, { ...valid, street: "x".repeat(201) }]) {
      const response = await resolve.POST(request("/api/geocode/resolve", { method: "POST", body }));
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 60));
    }
    assert.equal(mocks.resolveAddress.mock.calls.length, 0);
  });

  it("succès : champs nettoyés, pays en majuscules, lieu renvoyé", async () => {
    const place = { address: "1 rue de la Paix", city: "Paris", country: "FR", lat: 48.87, lng: 2.33 };
    mocks.resolveAddress.mockResolvedValue(place);
    const response = await resolve.POST(request("/api/geocode/resolve", { method: "POST", body: valid }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { place });
    assert.deepEqual(mocks.resolveAddress.mock.calls[0], [{ street: "1 rue de la Paix", city: "Paris", postalCode: "75002" }, "FR"]);
  });

  it("adresse introuvable : 404 ; service indisponible : 503", async () => {
    mocks.resolveAddress.mockResolvedValue(null);
    assert.equal((await resolve.POST(request("/api/geocode/resolve", { method: "POST", body: valid }))).status, 404);
    const { GeocodeUnavailableError } = await import("../../src/lib/geo/geocode");
    mocks.resolveAddress.mockRejectedValue(new GeocodeUnavailableError("geo.busy"));
    assert.equal((await resolve.POST(request("/api/geocode/resolve", { method: "POST", body: valid }))).status, 503);
  });

  it("limite de débit : 429 à la 31e requête de la même IP", async () => {
    mocks.resolveAddress.mockResolvedValue(null);
    const ip = "203.0.113.9";
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await resolve.POST(request("/api/geocode/resolve", { method: "POST", body: valid, ip }))).status, 404, `appel ${i + 1}`);
    }
    assert.equal((await resolve.POST(request("/api/geocode/resolve", { method: "POST", body: valid, ip }))).status, 429);
  });
});
