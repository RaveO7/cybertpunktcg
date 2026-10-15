import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import type { CardTranslations } from "../../src/i18n/cards";

/**
 * Traductions du texte de règles des cartes (src/i18n/cards/<langue>.json) : mots-clés {…},
 * affiliations en majuscules et nombres identiques à la source anglaise (cf. src/i18n/GLOSSARY.md).
 */

const DIR = path.join(__dirname, "../../src/i18n/cards");
const files = fs.readdirSync(DIR).filter((file) => file.endsWith(".json"));

const braces = (text: string) => (text.match(/\{[^}]+\}/g) ?? []).sort();
const capitals = (text: string) => (text.match(/\b[A-Z]{2,}\b/g) ?? []).sort();
const numbers = (text: string) => (text.match(/\d+/g) ?? []).sort();

describe("i18n : texte de règles des cartes traduit", () => {
  it("une traduction par langue sans impression officielle", () => {
    assert.deepEqual(files.sort(), ["de.json", "es.json", "it.json"]);
  });

  for (const file of files) {
    const translations = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as CardTranslations;
    it(`${file} : mots-clés, affiliations et nombres conservés`, () => {
      const problems: string[] = [];
      for (const [slug, { source, text }] of Object.entries(translations)) {
        if (!text.trim()) problems.push(`${slug} : vide`);
        if (text === source) problems.push(`${slug} : non traduit`);
        if (JSON.stringify(braces(text)) !== JSON.stringify(braces(source))) problems.push(`${slug} : mots-clés ${braces(text)} ≠ ${braces(source)}`);
        if (JSON.stringify(capitals(text)) !== JSON.stringify(capitals(source))) problems.push(`${slug} : majuscules ${capitals(text)} ≠ ${capitals(source)}`);
        if (JSON.stringify(numbers(text)) !== JSON.stringify(numbers(source))) problems.push(`${slug} : nombres ${numbers(text)} ≠ ${numbers(source)}`);
      }
      assert.deepEqual(problems, []);
    });
  }
});
