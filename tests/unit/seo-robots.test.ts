import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildRobots } from "../../src/lib/seo/robots";

describe("seo : robots.txt", () => {
  it("production : tout explorable sauf l'API et l'administration, sitemap absolu", () => {
    const robots = buildRobots({ VERCEL_ENV: "production", APP_URL: "https://tcgtracker.fr" });
    assert.deepEqual(robots.rules, { userAgent: "*", allow: ["/", "/api/shops/*/logo"], disallow: ["/api/", "/admin"] });
    assert.equal(robots.sitemap, "https://tcgtracker.fr/sitemap.xml");
  });

  it("prévisualisation : tout interdit", () => {
    const robots = buildRobots({ VERCEL_ENV: "preview", APP_URL: "https://tcgtracker.fr" });
    assert.deepEqual(robots.rules, { userAgent: "*", disallow: "/" });
    assert.equal(robots.sitemap, undefined);
  });
});
