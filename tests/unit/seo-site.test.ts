import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { absoluteUrl, isProductionDeployment, siteUrl } from "../../src/lib/seo/site";

describe("seo : adresse du site", () => {
  it("utilise APP_URL en priorité, sans barre finale", () => {
    assert.equal(siteUrl({ APP_URL: " https://tcgtracker.fr/ ", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }), "https://tcgtracker.fr");
  });

  it("se replie sur le domaine de production Vercel en https", () => {
    assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "tcg-tracker.vercel.app" }), "https://tcg-tracker.vercel.app");
  });

  it("se replie sur localhost sans configuration", () => {
    assert.equal(siteUrl({}), "http://localhost:3000");
  });

  it("construit des URL absolues", () => {
    assert.equal(absoluteUrl("/cartes", { APP_URL: "https://tcgtracker.fr" }), "https://tcgtracker.fr/cartes");
    assert.equal(absoluteUrl("en", { APP_URL: "https://tcgtracker.fr" }), "https://tcgtracker.fr/en");
  });

  it("n'indexe que la production", () => {
    assert.equal(isProductionDeployment({ VERCEL_ENV: "production" }), true);
    assert.equal(isProductionDeployment({ VERCEL_ENV: "preview", APP_URL: "https://tcgtracker.fr" }), false);
    assert.equal(isProductionDeployment({ APP_URL: "https://tcgtracker.fr" }), true);
    assert.equal(isProductionDeployment({}), false);
  });
});
