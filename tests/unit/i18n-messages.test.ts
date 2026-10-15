import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, it } from "vitest";
import { DEFAULT_LOCALE, LANGUAGES, LOCALES } from "../../src/i18n/config";
import { blockFiles } from "../../src/i18n/load";
import { pathnames } from "../../src/i18n/routing";

/**
 * Cohérence des traductions : chaque langue du registre a les mêmes blocs, les mêmes clés et les mêmes
 * variables que la référence française, et chaque texte est un message ICU valide.
 */

const ROOT = path.join(__dirname, "../../src/i18n/messages");

type Tree = Record<string, unknown>;

function jsonFiles(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return jsonFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name.endsWith(".json") ? [`${prefix}${entry.name.slice(0, -5)}`] : [];
  });
}

function readBlock(locale: string, file: string): Tree {
  return JSON.parse(fs.readFileSync(path.join(ROOT, locale, `${file}.json`), "utf8"));
}

/** Toutes les feuilles (textes) d'un bloc : chemin → valeur. Les tableaux sont parcourus par indice. */
function leaves(value: unknown, prefix = ""): Map<string, unknown> {
  const result = new Map<string, unknown>();
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      for (const [leaf, text] of leaves(child, prefix ? `${prefix}.${key}` : key)) result.set(leaf, text);
    }
  } else {
    result.set(prefix, value);
  }
  return result;
}

function variables(elements: MessageFormatElement[], into = new Set<string>()): Set<string> {
  for (const element of elements) {
    if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
    into.add(element.value);
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      for (const option of Object.values(element.options)) variables(option.value, into);
    }
    if (element.type === TYPE.tag) variables(element.children, into);
  }
  return into;
}

function icuVariables(text: string): Set<string> {
  return variables(parse(text, { ignoreTag: false }));
}

const referenceFiles = jsonFiles(path.join(ROOT, DEFAULT_LOCALE)).sort();

describe("i18n : registre des langues", () => {
  it("codes uniques, format régional reconnu par le moteur Intl", () => {
    assert.equal(new Set(LOCALES).size, LOCALES.length);
    assert.ok(LOCALES.includes(DEFAULT_LOCALE));
    for (const language of LANGUAGES) {
      // Sinon les formats retombent silencieusement en anglais.
      assert.deepEqual(Intl.NumberFormat.supportedLocalesOf([language.intl]), [language.intl], language.code);
    }
  });
});

describe("i18n : blocs de traductions", () => {
  it("la référence française importe chacun de ses blocs (fr/index.ts)", () => {
    assert.deepEqual([...blockFiles()].sort(), referenceFiles);
  });

  for (const locale of LOCALES) {
    describe(locale, () => {
      it("mêmes blocs que la référence", () => {
        assert.deepEqual(jsonFiles(path.join(ROOT, locale)).sort(), referenceFiles, `blocs de « ${locale} »`);
      });

      for (const file of referenceFiles) {
        it(`${file} : mêmes clés, messages ICU valides, mêmes variables`, () => {
          const target = path.join(ROOT, locale, `${file}.json`);
          if (!fs.existsSync(target)) return; // signalé par le test des blocs
          const reference = leaves(readBlock(DEFAULT_LOCALE, file));
          const translated = leaves(readBlock(locale, file));
          const missing = [...reference.keys()].filter((key) => !translated.has(key));
          const extra = [...translated.keys()].filter((key) => !reference.has(key));
          assert.deepEqual(missing, [], `clés manquantes en « ${locale} » (${file})`);
          assert.deepEqual(extra, [], `clés en trop en « ${locale} » (${file})`);
          for (const [key, text] of translated) {
            const source = reference.get(key);
            if (typeof source !== "string" || typeof text !== "string") {
              assert.equal(typeof text, typeof source, `${locale} ${file}.${key} : type`);
              continue;
            }
            assert.ok(text.trim(), `${locale} ${file}.${key} : texte vide`);
            assert.ok(!/^\s/.test(text), `${locale} ${file}.${key} : espace initial`);
            // Les espaces de bord servent de séparateur (« Possédée · ») : ils suivent la référence.
            assert.equal(/\s$/.test(text), /\s$/.test(source), `${locale} ${file}.${key} : espace final incohérent`);
            let found: Set<string>;
            try {
              found = icuVariables(text);
            } catch (error) {
              assert.fail(`${locale} ${file}.${key} : message ICU invalide (${(error as Error).message})`);
            }
            assert.deepEqual([...found].sort(), [...icuVariables(source)].sort(), `${locale} ${file}.${key} : variables`);
          }
        });
      }

      it("une URL déclarée pour chaque route traduite", () => {
        for (const [route, config] of Object.entries(pathnames)) {
          if (typeof config !== "string") assert.ok((config as Record<string, string>)[locale], `${route} en « ${locale} »`);
        }
      });
    });
  }
});
