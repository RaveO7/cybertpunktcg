import assert from "node:assert/strict";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const loadCatalogCached = vi.fn(async () => ({ sets: [], conditions: [], cards: [], printings: [] }));
vi.mock("@/lib/catalog", () => ({ CATALOG_CACHE_TAG: "catalog", loadCatalogCached }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("loadPublicCards", () => {
  beforeEach(() => {
    vi.resetModules();
    loadCatalogCached.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("au build : catalogue lu une seule fois par langue, pour toutes les fiches", async () => {
    vi.stubEnv("NEXT_PHASE", PHASE_PRODUCTION_BUILD);
    const { loadPublicCards } = await import("@/lib/seo/catalog-data");
    await Promise.all([loadPublicCards("fr"), loadPublicCards("fr"), loadPublicCards("en")]);
    await loadPublicCards("fr");
    assert.equal(loadCatalogCached.mock.calls.length, 2);
  });

  it("en service : relu à chaque rendu (le catalogue change à l'import des prix)", async () => {
    const { loadPublicCards } = await import("@/lib/seo/catalog-data");
    await loadPublicCards("fr");
    await loadPublicCards("fr");
    assert.equal(loadCatalogCached.mock.calls.length, 2);
  });
});
