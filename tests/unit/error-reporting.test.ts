import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { clientErrorSchema } from "../../src/lib/api-schemas";
import { toReport } from "../../src/lib/client/error-reporting";

const ORIGIN = "https://cybertpunktcg.vercel.app";
const page = { pathname: "/fr/cartes", serviceWorker: false };

function errorWithStack(message: string, stack: string) {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

describe("toReport", () => {
  it("erreur de la page (ex. hydratation React) : remontée, au format attendu par l'API", () => {
    const report = toReport(errorWithStack("Minified React error #418", `Error: x\n    at ${ORIGIN}/_next/static/chunks/a.js:1:2`), ORIGIN, page);
    assert.ok(report);
    assert.equal(report.message, "Error: Minified React error #418");
    assert.equal(report.path, "/fr/cartes");
    assert.ok(clientErrorSchema.safeParse(report).success);
  });

  it("ignore les extensions, les scripts d'autres sites, « Script error. » et les annulations", () => {
    assert.equal(toReport(errorWithStack("x", "at chrome-extension://abc/content.js:1:1"), ORIGIN, page), null);
    assert.equal(toReport(errorWithStack("x", "at https://ads.example.com/a.js:1:1"), ORIGIN, page), null);
    assert.equal(toReport("Script error.", ORIGIN, page), null);
    assert.equal(toReport(new DOMException("annulé", "AbortError"), ORIGIN, page), null);
  });

  it("tronque les textes trop longs", () => {
    const report = toReport(new Error("x".repeat(5000)), ORIGIN, page);
    assert.ok(report && report.message.length <= 1000 && (report.stack ?? "").length <= 4000);
  });
});
