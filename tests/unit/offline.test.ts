import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { OFFLINE_IMAGES_CACHE, offlineImageUrls } from "../../src/lib/offline";

function printing(imagePath: string | null) {
  return { imagePath } as { imagePath: string | null } & Record<string, never>;
}

describe("offlineImageUrls", () => {
  it("liste les miniatures des images locales, sans doublon", () => {
    const urls = offlineImageUrls({
      printings: [
        printing("/card-images/b.png"),
        printing("/card-images/a.webp"),
        printing("/card-images/a.webp"),
        printing(null),
        printing("https://example.com/externe.png"),
      ] as never,
    });
    assert.deepEqual(urls, ["/card-images/thumb/a.webp", "/card-images/thumb/b.webp"]);
  });

  it("garde l'image d'origine quand elle n'a pas de miniature", () => {
    const urls = offlineImageUrls({ printings: [printing("/card-images/sous/dossier.png")] as never });
    assert.deepEqual(urls, ["/card-images/sous/dossier.png"]);
  });
});

describe("service worker", () => {
  it("utilise le même cache d'images que src/lib/offline.ts", () => {
    const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
    const version = sw.match(/const VERSION = "([^"]+)"/)?.[1];
    assert.equal(`cptcg-images-${version}`, OFFLINE_IMAGES_CACHE);
  });
});
