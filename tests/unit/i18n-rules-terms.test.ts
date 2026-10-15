import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { LOCALES } from "../../src/i18n/config";

/**
 * Termes de jeu conservés dans les traductions des règles : mots-clés entre accolades ({Call},
 * {Attack}…) et mots en majuscules communs au français et à l'anglais (affiliations : BRAINDANCE,
 * ARASAKA…), tels qu'imprimés sur les cartes (cf. src/i18n/GLOSSARY.md).
 */

const ROOT = path.join(__dirname, "../../src/i18n/messages");
const BLOCKS = ["anatomy", "demoMatch", "examples", "howToPlay", "tutorial"];

function leaves(value: unknown, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "string") result.set(prefix, value);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      for (const [leaf, text] of leaves(child, prefix ? `${prefix}.${key}` : key)) result.set(leaf, text);
    }
  }
  return result;
}

function read(locale: string, block: string) {
  return leaves(JSON.parse(fs.readFileSync(path.join(ROOT, locale, "rules", `${block}.json`), "utf8")));
}

/** Accolades littérales, hors variables ICU des messages formatés ({n}, {count}…). */
function braces(text: string): string[] {
  return [...text.matchAll(/\{([A-Z][A-Za-z ]+)\}/g)].map((m) => m[0]).sort();
}

function capitals(text: string): Set<string> {
  return new Set(text.match(/\b[A-Z]{4,}\b/g) ?? []);
}

describe("i18n : termes de jeu conservés dans les règles traduites", () => {
  for (const block of BLOCKS) {
    const fr = read("fr", block);
    const en = read("en", block);
    for (const locale of LOCALES.filter((l) => l !== "fr" && l !== "en")) {
      it(`${locale} rules/${block}`, () => {
        const translated = read(locale, block);
        for (const [key, source] of en) {
          const text = translated.get(key);
          assert.ok(text !== undefined, `${locale} ${block}.${key} : manquant`);
          assert.deepEqual(braces(text), braces(source), `${locale} ${block}.${key} : mots-clés {…}`);
          // Majuscules communes au français et à l'anglais : termes imprimés (pas une emphase).
          const shared = [...capitals(source)].filter((word) => capitals(fr.get(key) ?? "").has(word));
          for (const word of shared) {
            if (source === source.toUpperCase()) continue; // sur-titre entièrement en capitales
            assert.ok(text.includes(word), `${locale} ${block}.${key} : « ${word} » absent`);
          }
        }
      });
    }
  }
});
