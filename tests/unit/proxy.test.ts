import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { describe, it } from "vitest";
import { proxy } from "../../src/proxy";

const ORIGIN = "https://tcg.example.com";

function request(path: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(`${ORIGIN}${path}`, { headers: { ...headers, ...(cookie ? { cookie } : {}) } });
}

const SESSION = { cptcg_session: "jeton" };

function location(response: Response) {
  const value = response.headers.get("location");
  return value ? value.replace(ORIGIN, "") : null;
}

function rewrite(response: Response) {
  const value = response.headers.get("x-middleware-rewrite");
  return value ? value.replace(ORIGIN, "") : null;
}

describe("proxy : langue de l'URL", () => {
  it("URL publique : servie par la page interne de sa langue, sans redirection", () => {
    assert.equal(rewrite(proxy(request("/cartes/v-streetkid"))), "/fr/cartes/v-streetkid");
    assert.equal(rewrite(proxy(request("/de/karten/v-streetkid"))), "/de/cartes/v-streetkid");
    assert.equal(rewrite(proxy(request("/"))), "/fr");
    assert.equal(rewrite(proxy(request("/it?ref=a"))), "/it?ref=a");
  });

  it("/cards : explorateur en français, liste des cartes en anglais", () => {
    assert.equal(rewrite(proxy(request("/cards"))), "/fr/cards");
    assert.equal(rewrite(proxy(request("/en/cards"))), "/en/cartes");
    assert.equal(rewrite(proxy(request("/de/explorer?q=v"))), "/de/cards?q=v");
  });

  it("visiteur et robot : jamais redirigés, même avec une préférence enregistrée", () => {
    const visitor = proxy(request("/cartes/v-streetkid", { "cptcg-locale": "de" }));
    assert.equal(visitor.status, 200);
    assert.equal(location(visitor), null);
    const bot = proxy(request("/cartes/v-streetkid", {}, { "user-agent": "Googlebot/2.1", "accept-language": "de-DE" }));
    assert.equal(bot.status, 200);
    assert.equal(rewrite(bot), "/fr/cartes/v-streetkid");
  });

  it("utilisateur connecté germanophone : même page dans sa langue", () => {
    const response = proxy(request("/cartes/v-streetkid", { ...SESSION, "cptcg-locale": "de" }));
    assert.equal(response.status, 307);
    assert.equal(location(response), "/de/karten/v-streetkid");
    assert.equal(location(proxy(request("/decks?tab=a", { ...SESSION, "cptcg-locale": "es" }))), "/es/decks?tab=a");
    assert.equal(location(proxy(request("/en/cards", { ...SESSION, "cptcg-locale": "fr" }))), "/cartes");
  });

  it("utilisateur connecté déjà dans sa langue, ou sans préférence : pas de redirection", () => {
    assert.equal(rewrite(proxy(request("/de/decks", { ...SESSION, "cptcg-locale": "de" }))), "/de/decks");
    assert.equal(rewrite(proxy(request("/decks", SESSION))), "/fr/decks");
  });

  it("chemin technique non traduit : redirection définitive vers l'URL publique", () => {
    const response = proxy(request("/de/cards/v-streetkid"));
    assert.equal(response.status, 308);
    assert.equal(location(response), "/de/karten/v-streetkid");
    assert.equal(location(proxy(request("/de/cartes/v-streetkid"))), "/de/karten/v-streetkid");
    assert.equal(location(proxy(request("/fr/cartes"))), "/cartes");
  });

  it("langue inconnue : aucune page (404 servie par l'application)", () => {
    const response = proxy(request("/nl/cards"));
    assert.equal(location(response), null);
    assert.equal(rewrite(response), "/fr/nl/cards");
  });

  it("annuaires réservés aux comptes : visiteur renvoyé vers l'accueil de sa langue", () => {
    assert.equal(location(proxy(request("/tournois/publics"))), "/#tournois");
    assert.equal(location(proxy(request("/de/boutiques"))), "/de#shops");
    assert.equal(location(proxy(request("/it/comment-jouer"))), "/it");
    assert.equal(rewrite(proxy(request("/de/boutiques", SESSION))), "/de/boutiques");
  });

  it("pays de connexion transmis dans un cookie", () => {
    const response = proxy(request("/", {}, { "x-vercel-ip-country": "es" }));
    assert.equal(response.cookies.get("cptcg-country")?.value, "ES");
  });
});
