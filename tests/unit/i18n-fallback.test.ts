import assert from "node:assert/strict";
import { createTranslator } from "next-intl";
import { describe, it } from "vitest";
import { blockFiles, loadMessages, mergeMessages, missingKeys } from "../../src/i18n/load";
import reference from "../../src/i18n/messages/fr";

describe("i18n : repli quand une traduction manque", () => {
  const fr = { landing: { title: "Titre", lead: "Accroche", cta: "Créer un compte", steps: ["un", "deux"] } };
  const en = { landing: { title: "Title", lead: "Lead", steps: ["one", "two"] } };
  const it_ = { landing: { title: "Titolo" } };

  it("clé absente en italien : texte anglais ; absente partout sauf en français : texte français", () => {
    const messages = mergeMessages(fr, en, it_);
    // Messages factices : hors du type des messages du site.
    const t = createTranslator({ locale: "it", messages: messages as never, namespace: "landing" as never }) as unknown as (key: string) => string;
    assert.equal(t("title"), "Titolo");
    assert.equal(t("lead"), "Lead");
    assert.equal(t("cta"), "Créer un compte");
  });

  it("contenus structurés (tableaux) : remplacés en entier, jamais mélangés", () => {
    assert.deepEqual(mergeMessages(fr, en, it_).landing, { title: "Titolo", lead: "Lead", cta: "Créer un compte", steps: ["one", "two"] });
  });

  it("liste des textes manquants d'une langue", () => {
    assert.deepEqual(missingKeys(fr, it_), ["landing.lead", "landing.cta", "landing.steps"]);
  });

  it("chargement réel : chaque langue reçoit toutes les clés de la référence", async () => {
    for (const locale of ["en", "de", "es", "it"] as const) {
      const messages = await loadMessages(locale);
      assert.deepEqual(missingKeys(reference, messages), [], locale);
    }
  });

  it("un fichier par bloc de la référence, les dossiers (rules/…) dépliés", () => {
    const files = blockFiles();
    assert.ok(files.includes("common"));
    assert.ok(files.includes("rules/howToPlay"));
    assert.ok(!files.includes("rules"));
    const groups = Object.keys(reference.rules).length;
    assert.equal(files.length, Object.keys(reference).length - 1 + groups);
  });
});
