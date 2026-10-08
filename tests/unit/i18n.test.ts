import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, intlLocale, isLocale, messages } from "../../src/lib/i18n/messages";

type Tree = { [key: string]: unknown };
type Leaf = { path: string; value: unknown };

function leaves(tree: Tree, prefix = ""): Leaf[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") return leaves(value as Tree, path);
    return [{ path, value }];
  });
}

const reference = leaves(messages[DEFAULT_LOCALE] as unknown as Tree);
const referenceByPath = new Map(reference.map((leaf) => [leaf.path, leaf.value]));
const others = LOCALES.map((locale) => locale.id).filter((id) => id !== DEFAULT_LOCALE);

/** Arguments sentinelles : nombres > 1 (pluriel), distincts, lisibles une fois interpolés. */
const SENTINELS = [7301, 7302, 7303, 7304, 7305];

function call(fn: unknown) {
  const f = fn as (...args: unknown[]) => unknown;
  return f(...SENTINELS.slice(0, f.length));
}

describe("i18n : locales", () => {
  it("chaque locale déclarée a ses messages, et réciproquement", () => {
    assert.deepEqual(Object.keys(messages).sort(), LOCALES.map((locale) => locale.id).sort());
    assert.equal(new Set(LOCALES.map((locale) => locale.id)).size, LOCALES.length);
    assert.ok(isLocale(DEFAULT_LOCALE));
  });

  it("isLocale / intlLocale", () => {
    for (const locale of LOCALES) {
      assert.equal(isLocale(locale.id), true);
      assert.equal(intlLocale(locale.id), locale.intl);
      // Le code Intl doit être reconnu par le moteur (sinon les formats retombent en anglais).
      assert.deepEqual(Intl.NumberFormat.supportedLocalesOf([locale.intl]), [locale.intl]);
    }
    for (const value of ["", "FR", "fr-FR", "pt", "constructor", "__proto__"]) assert.equal(isLocale(value), false, value);
    assert.equal(intlLocale("pt"), "fr-FR");
  });
});

describe("i18n : parité des messages", () => {
  it("la référence n'est pas vide", () => {
    assert.ok(reference.length > 100);
  });

  for (const locale of others) {
    it(`${locale} : mêmes clés que ${DEFAULT_LOCALE}, récursivement`, () => {
      const paths = leaves(messages[locale] as unknown as Tree).map((leaf) => leaf.path);
      const missing = reference.map((leaf) => leaf.path).filter((path) => !paths.includes(path));
      const extra = paths.filter((path) => !referenceByPath.has(path));
      assert.deepEqual(missing, [], `clés manquantes en ${locale}`);
      assert.deepEqual(extra, [], `clés en trop en ${locale}`);
    });

    it(`${locale} : mêmes types et même arité que ${DEFAULT_LOCALE}`, () => {
      const problems: string[] = [];
      for (const { path, value } of leaves(messages[locale] as unknown as Tree)) {
        const expected = referenceByPath.get(path);
        if (typeof value !== typeof expected) problems.push(`${path} : ${typeof value} au lieu de ${typeof expected}`);
        else if (typeof value === "function" && value.length !== (expected as () => unknown).length) {
          problems.push(`${path} : ${value.length} paramètre(s) au lieu de ${(expected as () => unknown).length}`);
        }
      }
      assert.deepEqual(problems, []);
    });
  }

  for (const locale of LOCALES.map((entry) => entry.id)) {
    it(`${locale} : aucune chaîne vide ni résultat de fonction vide / mal interpolé`, () => {
      const problems: string[] = [];
      for (const { path, value } of leaves(messages[locale] as unknown as Tree)) {
        if (typeof value === "string") {
          if (!value.trim()) problems.push(`${path} : chaîne vide`);
          // Les espaces de bord servent de séparateur (« Possédée · ») : ils doivent suivre la référence.
          const fr = referenceByPath.get(path);
          if (typeof fr === "string" && /\s$/.test(fr) !== /\s$/.test(value)) problems.push(`${path} : espace final incohérent`);
          if (/^\s/.test(value)) problems.push(`${path} : espace initial`);
          continue;
        }
        if (typeof value !== "function") {
          problems.push(`${path} : type ${typeof value}`);
          continue;
        }
        for (const n of [0, 1, 2]) {
          const f = value as (...args: unknown[]) => unknown;
          const output = f(...Array.from({ length: f.length }, () => n));
          if (typeof output !== "string" || !output.trim()) problems.push(`${path}(${n}) : résultat vide`);
        }
        const output = String(call(value));
        if (/undefined|NaN|\[object |null/.test(output)) problems.push(`${path} : « ${output} »`);
      }
      assert.deepEqual(problems, []);
    });
  }

  for (const locale of others) {
    it(`${locale} : chaque paramètre affiché en ${DEFAULT_LOCALE} l'est aussi`, () => {
      const problems: string[] = [];
      for (const { path, value } of leaves(messages[locale] as unknown as Tree)) {
        const expected = referenceByPath.get(path);
        if (typeof value !== "function" || typeof expected !== "function") continue;
        const frOutput = String(call(expected));
        const output = String(call(value));
        for (const sentinel of SENTINELS) {
          const token = String(sentinel);
          if (frOutput.includes(token) && !output.includes(token)) {
            problems.push(`${path} : paramètre ${SENTINELS.indexOf(sentinel) + 1} absent (« ${output} »)`);
          }
        }
      }
      assert.deepEqual(problems, []);
    });
  }

  it("les pluriels de la référence distinguent 1 et plusieurs", () => {
    const fr = messages.fr;
    assert.notEqual(fr.common.copies(1), fr.common.copies(2));
    assert.notEqual(fr.common.cards(1), fr.common.cards(2));
    assert.equal(fr.common.cards(0), fr.common.cards(1), "en français, 0 est singulier");
  });

  it("aucune traduction n'est restée en français par oubli (hors noms propres et mots courts)", () => {
    const suspicious: string[] = [];
    for (const locale of others) {
      for (const { path, value } of leaves(messages[locale] as unknown as Tree)) {
        const fr = referenceByPath.get(path);
        if (typeof value !== "string" || typeof fr !== "string") continue;
        // Phrases longues identiques au français : très probablement non traduites.
        if (value === fr && fr.split(/\s+/).length >= 4) suspicious.push(`${locale}:${path}`);
      }
    }
    assert.deepEqual(suspicious, []);
  });
});
