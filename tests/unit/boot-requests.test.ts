import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_REQUESTS_SCRIPT, takeBootRequests } from "@/lib/boot-requests";
import { SESSION_USER_KEY } from "@/lib/session-hint";

/** Exécute le script du <head> à l'adresse donnée ; rend les URL demandées. */
function runBootScript(url: string, { remembered = true } = {}) {
  const requested: string[] = [];
  const fetchStub = vi.fn((input: string) => {
    requested.push(input);
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  const { pathname, search } = new URL(url, "https://site.test");
  vi.stubGlobal("fetch", fetchStub);
  vi.stubGlobal("location", { pathname, search });
  vi.stubGlobal("localStorage", { getItem: (key: string) => (remembered && key === SESSION_USER_KEY ? "{}" : null) });
  vi.stubGlobal("window", globalThis);
  new Function(BOOT_REQUESTS_SCRIPT)();
  return requested;
}

describe("BOOT_REQUESTS_SCRIPT", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lance collection et catalogue sur les pages qui affichent le catalogue", () => {
    expect(runBootScript("/fr/cards")).toEqual(["/api/collection", "/api/catalog"]);
    expect(runBootScript("/fr")).toEqual(["/api/collection", "/api/catalog"]);
    expect(runBootScript("/fr/decks?deck=abc")).toEqual(["/api/collection", "/api/catalog"]);
    takeBootRequests();
  });

  it("ne lance pas le catalogue sur la liste des decks", () => {
    expect(runBootScript("/fr/decks")).toEqual(["/api/collection"]);
    expect(runBootScript("/de/decks/")).toEqual(["/api/collection"]);
    const boot = takeBootRequests();
    expect(boot?.catalog).toBeUndefined();
    expect(boot?.collection).toBeInstanceOf(Promise);
  });

  it("ne lance rien sans session mémorisée", () => {
    expect(runBootScript("/fr/cards", { remembered: false })).toEqual([]);
  });
});
