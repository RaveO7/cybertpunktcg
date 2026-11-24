import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { INDEXNOW_KEY, INDEXNOW_MAX_URLS, indexNowPayloads, indexNowUrls } from "../../src/lib/seo/indexnow";

describe("IndexNow", () => {
  const entries = [
    { url: "https://site.test/fr" },
    { url: "https://site.test/fr/cartes/a", lastModified: new Date("2026-11-01T00:00:00Z") },
    { url: "https://site.test/fr/cartes/b", lastModified: new Date("2026-11-20T00:00:00Z") },
  ];

  it("premier envoi : toutes les pages ; ensuite : seulement celles modifiées depuis", () => {
    assert.equal(indexNowUrls(entries, null).length, 3);
    assert.deepEqual(indexNowUrls(entries, new Date("2026-11-10T00:00:00Z")), ["https://site.test/fr/cartes/b"]);
    assert.deepEqual(indexNowUrls(entries, new Date("2026-11-20T00:00:00Z")), []);
  });

  it("requêtes par lots de 10 000 URL, avec l'hôte et l'adresse de la clé", () => {
    const urls = Array.from({ length: INDEXNOW_MAX_URLS + 1 }, (_, i) => `https://site.test/p/${i}`);
    const payloads = indexNowPayloads("https://site.test", urls);
    assert.deepEqual(payloads.map((payload) => payload.urlList.length), [INDEXNOW_MAX_URLS, 1]);
    assert.equal(payloads[0].host, "site.test");
    assert.equal(payloads[0].keyLocation, `https://site.test/${INDEXNOW_KEY}.txt`);
  });
});
