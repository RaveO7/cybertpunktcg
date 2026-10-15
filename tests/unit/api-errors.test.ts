import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { tournamentCreateSchema, validate, validationError } from "../../src/lib/api-schemas";
import { apiError, errorResponse, requestLocale } from "../../src/lib/api-response";
import { AppError, apiMessage, decodeApiMessage } from "../../src/lib/app-error";

const ORIGIN = "https://tcg.example.com";

function request(headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/test`, { headers });
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: string }).error;
}

describe("langue d'une requête d'API", () => {
  it("suit la page d'origine du même site", () => {
    assert.equal(requestLocale(request({ referer: `${ORIGIN}/de/turniere` })), "de");
    assert.equal(requestLocale(request({ referer: `${ORIGIN}/en/cards/x` })), "en");
    assert.equal(requestLocale(request({ referer: `${ORIGIN}/tournois` })), "fr");
  });

  it("ignore un Referer d'un autre site, puis lit la langue choisie", () => {
    const headers = { referer: "https://accounts.google.com/de/x", cookie: "a=1; cptcg-locale=it" };
    assert.equal(requestLocale(request(headers)), "it");
    assert.equal(requestLocale(request({ cookie: "cptcg-locale=xx" })), "fr");
    assert.equal(requestLocale(request()), "fr");
  });
});

describe("messages d'erreur traduits", () => {
  it("dans la langue de la page, avec les valeurs", async () => {
    const de = request({ referer: `${ORIGIN}/de/boutiques` });
    assert.equal(await errorOf(await apiError(de, "shops.limitReached", 409, { values: { max: 3 } })), "Du verwaltest bereits 3 Läden.");
    const es = request({ referer: `${ORIGIN}/es/` });
    assert.equal(await errorOf(await apiError(es, "common.sessionRequired", 401)), "Debes iniciar sesión.");
  });

  it("refus métier : statut, détails et pluriel", async () => {
    const error = new AppError("tournaments.pendingRegistrations", 409, { pending: 2 }, { count: 2 });
    const response = await errorResponse(request(), "test", error);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "2 inscriptions en attente d'approbation.",
      details: { pending: 2 },
    });
    const en = await errorResponse(request({ cookie: "cptcg-locale=en" }), "test", error);
    assert.equal(await errorOf(en), "2 registrations awaiting approval.");
  });

  it("champs manquants pour publier : un seul ou les deux", async () => {
    const it = request({ referer: `${ORIGIN}/it/` });
    const one = new AppError("tournaments.publishMissing", 409, undefined, { missing: "place" });
    const both = new AppError("tournaments.publishMissing", 409, undefined, { missing: "both" });
    assert.equal(await errorOf(await errorResponse(it, "test", one)), "Per pubblicare, manca un luogo localizzato.");
    assert.equal(
      await errorOf(await errorResponse(request(), "test", both)),
      "Pour publier, il manque une date de début à venir et un lieu localisé.",
    );
  });

  it("une erreur inattendue reste générique", async () => {
    const response = await errorResponse(request({ cookie: "cptcg-locale=en" }), "test", new Error("secret"), "common.saveFailed");
    assert.equal(response.status, 400);
    assert.equal(await errorOf(response), "Could not save.");
  });

  it("validation : la clé et ses bornes traversent Zod", async () => {
    const parsed = validate(tournamentCreateSchema, { name: "Open", roundMinutes: 5 });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.deepEqual(parsed.failure, {
      key: "tournaments.invalidRoundMinutes",
      values: { min: "10", max: "180" },
      status: 400,
    });
    const en = await validationError(request({ referer: `${ORIGIN}/en/` }), parsed.failure);
    assert.equal(await errorOf(en), "Invalid round length (10 to 180 minutes).");
  });

  it("encodage des messages de schéma", () => {
    assert.equal(apiMessage("common.invalidRequest"), "common.invalidRequest");
    assert.deepEqual(decodeApiMessage(apiMessage("decks.nameTooLong", { max: 60 })), {
      key: "decks.nameTooLong",
      values: { max: "60" },
    });
    assert.equal(decodeApiMessage("Invalid input: expected string"), null);
  });
});
