import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import {
  buildPortfolioHistory,
  buildPrintingHistory,
  extendPortfolioHistory,
  shiftUtcDay,
  utcDay,
  utcDayKey,
} from "../../src/lib/price-history";

describe("utcDay / utcDayKey", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
    vi.useRealTimers();
  });

  it("ramène à minuit UTC, quelle que soit l'heure ou le décalage", () => {
    assert.equal(utcDay("2026-03-15").toISOString(), "2026-03-15T00:00:00.000Z");
    assert.equal(utcDay("2026-03-15T23:59:59.999Z").toISOString(), "2026-03-15T00:00:00.000Z");
    // 01:30 à Paris (+02:00) = 23:30 UTC la veille.
    assert.equal(utcDayKey("2026-01-01T01:30:00+02:00"), "2025-12-31");
    assert.equal(utcDayKey("2025-12-31T23:30:00-05:00"), "2026-01-01");
  });

  it("une date « AAAA-MM-JJ » est lue en UTC, pas en heure locale", () => {
    for (const tz of ["Pacific/Kiritimati", "America/Los_Angeles", "Europe/Paris", "UTC"]) {
      process.env.TZ = tz;
      assert.equal(utcDayKey("2026-06-01"), "2026-06-01", tz);
      assert.equal(utcDayKey(new Date("2026-06-01T23:30:00.000Z")), "2026-06-01", tz);
    }
  });

  it("ne modifie pas la Date reçue et renvoie un nouvel objet", () => {
    const input = new Date("2026-05-05T12:34:56.000Z");
    const day = utcDay(input);
    assert.equal(input.toISOString(), "2026-05-05T12:34:56.000Z");
    assert.notEqual(day, input);
  });

  it("par défaut : aujourd'hui en UTC", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T23:59:00.000Z"), toFake: ["Date"] });
    assert.equal(utcDayKey(), "2026-10-08");
    assert.equal(utcDay().toISOString(), "2026-10-08T00:00:00.000Z");
  });

  it("date illisible → erreur explicite", () => {
    for (const value of ["", "pas une date", "2026-13-01", new Date(Number.NaN)]) {
      assert.throws(() => utcDay(value), /Date de snapshot invalide/);
    }
  });

  // Attendu : une date calendaire impossible est refusée comme les autres dates invalides.
  // Observé : « 2026-02-30 » passe le motif AAAA-MM-JJ et V8 la reporte au 2026-03-02.
  it("une date impossible (30 février) est refusée au lieu d'être reportée en mars", () => {
    assert.throws(() => utcDay("2026-02-30"), /Date de snapshot invalide/);
  });
});

describe("shiftUtcDay", () => {
  it("franchit fins de mois, d'année et années bissextiles", () => {
    const cases: [string, number, string][] = [
      ["2026-01-31", 1, "2026-02-01"],
      ["2026-03-01", -1, "2026-02-28"],
      ["2024-03-01", -1, "2024-02-29"],
      ["2024-02-28", 1, "2024-02-29"],
      ["2025-12-31", 1, "2026-01-01"],
      ["2026-01-01", -1, "2025-12-31"],
      ["2026-01-01", 365, "2027-01-01"],
      ["2024-01-01", 366, "2025-01-01"],
      ["2026-06-15", 0, "2026-06-15"],
      ["2026-06-15", -30, "2026-05-16"],
    ];
    for (const [day, delta, expected] of cases) {
      assert.equal(utcDayKey(shiftUtcDay(day, delta)), expected, `${day} ${delta}`);
    }
  });

  it("insensible aux changements d'heure locaux", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Europe/Paris";
      // Nuit du passage à l'heure d'été (29 mars 2026) et d'hiver (25 octobre 2026).
      assert.equal(utcDayKey(shiftUtcDay("2026-03-28", 1)), "2026-03-29");
      assert.equal(utcDayKey(shiftUtcDay("2026-03-29", 1)), "2026-03-30");
      assert.equal(utcDayKey(shiftUtcDay("2026-10-25", 1)), "2026-10-26");
      assert.equal(shiftUtcDay("2026-10-25", 1).toISOString(), "2026-10-26T00:00:00.000Z");
    } finally {
      process.env.TZ = original;
    }
  });

  it("tronque l'heure avant de décaler et ne modifie pas l'entrée", () => {
    const input = new Date("2026-04-10T22:00:00.000Z");
    assert.equal(shiftUtcDay(input, 1).toISOString(), "2026-04-11T00:00:00.000Z");
    assert.equal(input.toISOString(), "2026-04-10T22:00:00.000Z");
  });
});

describe("extendPortfolioHistory / buildPortfolioHistory (cas limites)", () => {
  it("aucune carte possédée : aucun point, prix de départ recopiés (pas partagés)", () => {
    const start = new Map([["a", 3]]);
    const result = extendPortfolioHistory([{ printingId: "a", quantity: 0 }], start, [{ printingId: "a", day: "2026-01-01", amount: 5 }]);
    assert.deepEqual(result.points, []);
    assert.deepEqual([...result.lastPrice], [["a", 3]]);
    assert.notEqual(result.lastPrice, start);
    assert.deepEqual(buildPortfolioHistory([], []), []);
  });

  it("additionne les lignes d'une même carte (plusieurs états) et ignore les quantités négatives", () => {
    const points = buildPortfolioHistory(
      [
        { printingId: "a", quantity: 2 },
        { printingId: "a", quantity: 1 },
        { printingId: "b", quantity: -4 },
      ],
      [
        { printingId: "a", day: "2026-01-01", amount: 2 },
        { printingId: "b", day: "2026-01-01", amount: 100 },
      ],
    );
    assert.deepEqual(points, [{ day: "2026-01-01", marketTotal: 6, pricedCopies: 3 }]);
  });

  it("prix nul, négatif ou non fini : ignoré, le dernier prix valide est conservé", () => {
    const points = buildPortfolioHistory(
      [{ printingId: "a", quantity: 1 }],
      [
        { printingId: "a", day: "2026-01-01", amount: 4 },
        { printingId: "a", day: "2026-01-02", amount: 0 },
        { printingId: "a", day: "2026-01-03", amount: Number.NaN },
        { printingId: "a", day: "2026-01-04", amount: -1 },
        { printingId: "a", day: "2026-01-05", amount: Infinity },
        { printingId: "a", day: "2026-01-06", amount: 5 },
      ],
    );
    assert.deepEqual(points, [
      { day: "2026-01-01", marketTotal: 4, pricedCopies: 1 },
      { day: "2026-01-06", marketTotal: 5, pricedCopies: 1 },
    ]);
  });

  it("snapshots non triés : la courbe est chronologique ; doublon du même jour : le dernier gagne", () => {
    const points = buildPortfolioHistory(
      [{ printingId: "a", quantity: 1 }],
      [
        { printingId: "a", day: "2026-01-03", amount: 3 },
        { printingId: "a", day: "2026-01-01", amount: 1 },
        { printingId: "a", day: "2026-01-01", amount: 1.5 },
      ],
    );
    assert.deepEqual(points.map((p) => [p.day, p.marketTotal]), [
      ["2026-01-01", 1.5],
      ["2026-01-03", 3],
    ]);
  });

  it("les copies sans aucun prix ne comptent pas, le total est arrondi au centime", () => {
    const points = buildPortfolioHistory(
      [
        { printingId: "a", quantity: 3 },
        { printingId: "b", quantity: 2 },
      ],
      [
        { printingId: "a", day: "2026-01-01", amount: 0.1 },
        { printingId: "b", day: "2026-01-02", amount: 0.2 },
      ],
    );
    assert.deepEqual(points, [
      { day: "2026-01-01", marketTotal: 0.3, pricedCopies: 3 },
      { day: "2026-01-02", marketTotal: 0.7, pricedCopies: 5 },
    ]);
  });

  it("un prix de départ suffit à valoriser une carte sans nouveau snapshot", () => {
    const { points, lastPrice } = extendPortfolioHistory(
      [
        { printingId: "a", quantity: 1 },
        { printingId: "b", quantity: 1 },
      ],
      new Map([["a", 10]]),
      [{ printingId: "b", day: "2026-02-01", amount: 1 }],
    );
    assert.deepEqual(points, [{ day: "2026-02-01", marketTotal: 11, pricedCopies: 2 }]);
    assert.deepEqual(Object.fromEntries(lastPrice), { a: 10, b: 1 });
  });
});

describe("buildPrintingHistory (cas limites)", () => {
  it("ignore les prix invalides, dédoublonne par jour (dernier gagne), trie et arrondit", () => {
    assert.deepEqual(
      buildPrintingHistory([
        { printingId: "a", day: "2026-01-03", amount: 1.005 + 2 },
        { printingId: "a", day: "2026-01-01", amount: 0 },
        { printingId: "a", day: "2026-01-02", amount: 2.5 },
        { printingId: "a", day: "2026-01-02", amount: 2.75 },
        { printingId: "a", day: "2026-01-04", amount: Number.NaN },
        { printingId: "a", day: "2025-12-31", amount: 0.333333 },
      ]),
      [
        { day: "2025-12-31", amount: 0.33 },
        { day: "2026-01-02", amount: 2.75 },
        { day: "2026-01-03", amount: 3.01 },
      ],
    );
    assert.deepEqual(buildPrintingHistory([]), []);
  });
});
