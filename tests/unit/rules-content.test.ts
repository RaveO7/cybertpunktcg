import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { LOCALES } from "../../src/i18n/config";
import { ANATOMY_CARDS } from "../../src/lib/rules/card-anatomy";
import { EXAMPLE_CARDS, type PlaymatZoneId } from "../../src/lib/rules/examples";
import { MISSION_FLOW } from "../../src/lib/rules/tutorial";
import { anatomyFor, howtoFor, noteFor, tutorialFor } from "../helpers/rules-content";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const exampleKeys = Object.keys(EXAMPLE_CARDS) as (keyof typeof EXAMPLE_CARDS)[];

/** Règle officielle : 1 Gig dès Power 1, +1 par tranche de 10 (0 à Power 0). */
function gigsStolen(power: number): number {
  return power <= 0 ? 0 : 1 + Math.floor(power / 10);
}

/**
 * Noms acceptés pour un type de carte dans une langue : le terme anglais (gardé par les contenus
 * français et anglais) ou le libellé du catalogue de la langue (« Legende »), et « Gear » (glossaire).
 */
function typeNames(locale: string, type: string): string[] {
  const catalog = JSON.parse(readFileSync(`${ROOT}src/i18n/messages/${locale}/catalog.json`, "utf8")) as { types: Record<string, string> };
  return [type, catalog.types[type]];
}

function firstInt(text: string): number {
  const m = text.match(/\d+/);
  assert.ok(m, `aucun nombre dans « ${text} »`);
  return Number(m[0]);
}

function allInts(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}

/** Champs qui sont des identifiants : ils doivent être identiques d'une langue à l'autre. */
const IDENTITY_KEYS = new Set(["id", "zone", "key", "exampleKey", "correct", "sourceUrl", "sourcePdfUrl"]);

/**
 * Compare récursivement deux contenus localisés : même structure (clés, longueurs de tableaux),
 * mêmes identifiants, et aucune chaîne vide d'un côté comme de l'autre.
 */
function assertSameShape(a: unknown, b: unknown, path: string): void {
  if (typeof a === "string") {
    assert.equal(typeof b, "string", `${path} : type différent`);
    assert.ok(a.trim().length > 0, `${path} : chaîne vide (fr)`);
    assert.ok((b as string).trim().length > 0, `${path} : chaîne vide (en)`);
    return;
  }
  if (typeof a === "function") {
    assert.equal(typeof b, "function", `${path} : fonction manquante`);
    return;
  }
  if (Array.isArray(a)) {
    assert.ok(Array.isArray(b), `${path} : tableau attendu`);
    assert.equal(a.length, (b as unknown[]).length, `${path} : longueurs différentes`);
    a.forEach((item, i) => assertSameShape(item, (b as unknown[])[i], `${path}[${i}]`));
    return;
  }
  if (a && typeof a === "object") {
    assert.ok(b && typeof b === "object", `${path} : objet attendu`);
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b as object).sort();
    assert.deepEqual(ka, kb, `${path} : clés différentes`);
    for (const k of ka) {
      const va: unknown = (a as Record<string, unknown>)[k];
      const vb: unknown = (b as Record<string, unknown>)[k];
      // `correct` est aussi un libellé (« Bien joué ») au premier niveau : seul le booléen est un identifiant.
      const isIdentity = IDENTITY_KEYS.has(k) && !(k === "correct" && typeof va === "string");
      if (isIdentity) assert.deepEqual(va, vb, `${path}.${k} : identifiant différent entre langues`);
      else assertSameShape(va, vb, `${path}.${k}`);
    }
    return;
  }
  assert.equal(typeof a, typeof b, `${path} : type différent`);
}

describe("EXAMPLE_CARDS (cartes d'exemple)", () => {
  it("noms et images sont uniques", () => {
    const names = exampleKeys.map((k) => EXAMPLE_CARDS[k].name);
    const images = exampleKeys.map((k) => EXAMPLE_CARDS[k].imagePath);
    assert.equal(new Set(names).size, names.length);
    assert.equal(new Set(images).size, images.length);
  });

  it("chaque image existe dans public/ (versionnée)", () => {
    for (const k of exampleKeys) {
      const { imagePath } = EXAMPLE_CARDS[k];
      assert.match(imagePath, /^\/card-images\/[\w-]+\.webp$/, k);
      assert.ok(existsSync(`${ROOT}public${imagePath}`), `${k} : ${imagePath} introuvable`);
    }
  });

  it("le lien catalogue recherche le nom de la carte", () => {
    for (const k of exampleKeys) {
      const card = EXAMPLE_CARDS[k];
      const url = new URL(card.href, "https://example.com");
      assert.equal(url.pathname, "/cards", k);
      const q = url.searchParams.get("q");
      assert.ok(q && card.name.startsWith(q), `${k} : q=« ${q} » ne correspond pas à « ${card.name} »`);
    }
  });

  it("coût/Power cohérents avec le type (Unit chiffrée, Program sans Power)", () => {
    for (const k of exampleKeys) {
      const card: { type: string; cost?: number | null; power?: number | null } = EXAMPLE_CARDS[k];
      if (card.type === "Unit") {
        assert.ok(typeof card.cost === "number" && card.cost >= 0, `${k} : coût`);
        assert.ok(typeof card.power === "number" && card.power > 0, `${k} : power`);
      }
      if (card.type === "Program") assert.equal(card.power ?? null, null, `${k} : un Program n'a pas de Power`);
      if (card.type !== "Legend") assert.ok(typeof card.cost === "number", `${k} : coût manquant`);
    }
  });

  it("notes renseignées dans chaque langue, et traduites", () => {
    for (const k of exampleKeys) {
      for (const locale of LOCALES) assert.ok(noteFor(locale, k)?.trim(), `${k} : note ${locale}`);
      assert.notEqual(noteFor("fr", k), noteFor("en", k), `${k} : note non traduite`);
    }
  });

  it("une note annonçant « Power N → X Gigs » respecte la Power de la carte et la règle de vol", () => {
    for (const k of exampleKeys) {
      const card = EXAMPLE_CARDS[k] as { power?: number | null };
      for (const note of LOCALES.map((locale) => noteFor(locale, k))) {
        const m = note.match(/Power (\d+)\D+?(\d+) Gigs?/);
        if (!m) continue;
        assert.equal(Number(m[1]), card.power, `${k} : Power annoncée`);
        assert.equal(Number(m[2]), gigsStolen(Number(m[1])), `${k} : Gigs volés`);
      }
    }
  });
});

describe("Anatomie d'une carte", () => {
  const expectedType = { unit: "Unit", program: "Program", legend: "Legend" } as const;

  it("ids uniques et carte d'exemple du bon type", () => {
    const ids = ANATOMY_CARDS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const card of ANATOMY_CARDS) {
      assert.ok(card.exampleKey in EXAMPLE_CARDS, card.id);
      assert.equal(EXAMPLE_CARDS[card.exampleKey].type, expectedType[card.id], card.id);
    }
  });

  it("chaque repère est unique par carte (numérotation via findIndex) et dans les bornes de l'image", () => {
    for (const card of ANATOMY_CARDS) {
      const parts = card.points.map((p) => p.part);
      assert.equal(new Set(parts).size, parts.length, `${card.id} : repère en double`);
      assert.ok(card.points.length > 0);
      assert.ok(card.points.some((p) => p.side === "left") && card.points.some((p) => p.side === "right"));
      for (const p of card.points) {
        assert.ok(p.x >= 0 && p.x <= 100, `${card.id}.${p.part} x=${p.x}`);
        assert.ok(p.y >= 0 && p.y <= 100, `${card.id}.${p.part} y=${p.y}`);
      }
    }
  });

  it("pas de repère Power sur un Program", () => {
    for (const card of ANATOMY_CARDS) {
      if (EXAMPLE_CARDS[card.exampleKey].type === "Program") {
        assert.ok(!card.points.some((p) => p.part === "power"), card.id);
      }
    }
  });

  it("chaque repère et onglet a son texte dans les deux langues", () => {
    for (const locale of LOCALES) {
      const copy = anatomyFor(locale);
      for (const card of ANATOMY_CARDS) {
        assert.ok(copy.cards[card.id].tab.trim(), `${locale} ${card.id} tab`);
        assert.ok(copy.cards[card.id].caption.trim(), `${locale} ${card.id} caption`);
        for (const p of card.points) {
          assert.ok(copy.parts[p.part]?.name.trim(), `${locale} ${p.part} name`);
          assert.ok(copy.parts[p.part]?.body.trim(), `${locale} ${p.part} body`);
        }
      }
    }
  });

  it("la légende d'onglet correspond au nom de la carte d'exemple", () => {
    for (const locale of LOCALES) {
      const copy = anatomyFor(locale);
      for (const card of ANATOMY_CARDS) {
        assert.equal(copy.cards[card.id].caption, EXAMPLE_CARDS[card.exampleKey].name, `${locale} ${card.id}`);
      }
    }
  });

  it("les surcharges Legend ne portent que sur des repères présents sur la carte Legend", () => {
    const legend = ANATOMY_CARDS.find((c) => c.id === "legend");
    assert.ok(legend);
    const parts = new Set(legend.points.map((p) => p.part));
    for (const locale of LOCALES) {
      for (const part of Object.keys(anatomyFor(locale).legendOverrides)) {
        assert.ok(parts.has(part as never), `${locale} : surcharge ${part} sans repère`);
      }
    }
  });

  it("FR et EN ont la même structure, sans chaîne vide", () => {
    for (const locale of LOCALES) assertSameShape(anatomyFor("fr"), anatomyFor(locale), `anatomy ${locale}`);
  });
});

describe("Règles détaillées (howto-play)", () => {
  const fr = howtoFor("fr");
  const all = LOCALES.map(howtoFor);

  it("chaque langue a la même structure que le français, les mêmes ids et aucune chaîne vide", () => {
    for (const id of LOCALES) assertSameShape(fr, howtoFor(id), `howto ${id}`);
  });

  it("le sommaire pointe vers des sections existantes de HowToPlayRules", () => {
    const src = readFileSync(`${ROOT}src/components/HowToPlayRules.tsx`, "utf8");
    const sectionIds = new Set([...src.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(sectionIds.size > 0);
    const tocIds = fr.toc.map((t) => t.id);
    assert.equal(new Set(tocIds).size, tocIds.length, "id de sommaire en double");
    for (const id of tocIds) assert.ok(sectionIds.has(id), `#${id} sans section`);
    for (const id of sectionIds) assert.ok(tocIds.includes(id), `section #${id} absente du sommaire`);
  });

  it("zones : ids uniques, chacune a son libellé de tapis", () => {
    for (const c of all) {
      const ids = c.areas.items.map((a) => a.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const id of ids) {
        const label = (c.playmat as Record<PlaymatZoneId, string>)[id];
        assert.ok(typeof label === "string" && label.trim(), `libellé de tapis manquant pour ${id}`);
      }
    }
  });

  it("zones : couvrent toutes les zones du diagramme PlaymatDiagram", () => {
    const src = readFileSync(`${ROOT}src/components/PlaymatDiagram.tsx`, "utf8");
    const m = src.match(/ZONE_ORDER[^=]*=\s*\[([^\]]+)\]/);
    assert.ok(m, "ZONE_ORDER introuvable");
    const diagram = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(fr.areas.items.map((a) => a.id).sort(), diagram);
  });

  it("types de cartes : exemple existant et du type décrit, 4 types distincts", () => {
    LOCALES.forEach((locale, index) => {
      const c = all[index];
      for (const item of c.cardTypes.items) {
        assert.ok(typeNames(locale, EXAMPLE_CARDS[item.exampleKey].type).includes(item.name), `${locale} ${item.name}`);
      }
      assert.equal(new Set(c.cardTypes.items.map((i) => i.name)).size, 4);
    });
  });

  it("mots-clés et triggers : noms uniques, exemples existants", () => {
    for (const c of all) {
      for (const list of [c.keywords.items, c.triggers.items]) {
        const names = list.map((i) => i.name);
        assert.equal(new Set(names).size, names.length);
        for (const item of list) {
          if (item.exampleKey) assert.ok(item.exampleKey in EXAMPLE_CARDS, item.name);
        }
      }
      for (const kw of c.keywords.items) {
        if (kw.name === "Go Solo") assert.equal(EXAMPLE_CARDS[kw.exampleKey!].type, "Legend");
        if (kw.name === "Adrenaline" || kw.name === "Blocker") {
          assert.equal(EXAMPLE_CARDS[kw.exampleKey!].type, "Unit", kw.name);
        }
      }
    }
  });

  it("le tapis annonce une Street Cred arithmétiquement juste", () => {
    for (const c of all) {
      const m = c.playmat.streetCred.match(/=\s*([\d+\s]+?)\s*=\s*(\d+)/);
      assert.ok(m, c.playmat.streetCred);
      const sum = m[1].split("+").reduce((acc, n) => acc + Number(n.trim()), 0);
      assert.equal(sum, Number(m[2]));
    }
  });

  it("l'exemple de vol (Adam Smasher) respecte sa Power et la règle de vol", () => {
    for (const c of all) {
      const [power, gigs] = allInts(c.stealExample.body.replace(/10\+/, ""));
      assert.equal(power, EXAMPLE_CARDS.unitSmasher.power);
      assert.equal(gigs, gigsStolen(power));
    }
  });

  it("paliers de vol affichés conformes à la règle", () => {
    for (const c of all) {
      assert.ok(c.attack.stealTiers.length >= 2);
      for (const tier of c.attack.stealTiers) {
        const [power, gigs] = allInts(tier);
        assert.equal(gigs, gigsStolen(power), tier);
      }
    }
  });

  it("sources officielles en https", () => {
    for (const c of all) {
      assert.match(c.sourceUrl, /^https:\/\//);
      assert.match(c.sourcePdfUrl, /^https:\/\/.+\.pdf$/);
    }
  });
});

describe("Parcours tutoriel (tutorial)", () => {
  const fr = tutorialFor("fr");
  const en = tutorialFor("en");
  const all = LOCALES.map(tutorialFor);
  const zoneIds = new Set(howtoFor("fr").areas.items.map((a) => a.id));

  it("chaque langue a la même structure que le français, les mêmes ids/réponses et aucune chaîne vide", () => {
    for (const id of LOCALES) assertSameShape(fr, tutorialFor(id), `tutorial ${id}`);
  });

  it("missions : même ordre que MISSION_FLOW, ids et badges uniques", () => {
    for (const c of all) {
      assert.deepEqual(c.missions.map((m) => m.id), MISSION_FLOW);
      assert.equal(new Set(c.missions.map((m) => m.badge)).size, c.missions.length);
    }
    assert.equal(new Set(MISSION_FLOW).size, MISSION_FLOW.length);
    assert.equal(MISSION_FLOW[0], "intro");
    assert.equal(MISSION_FLOW[MISSION_FLOW.length - 1], "done");
  });

  it("badges numérotés dans l'ordre des missions", () => {
    const numbered = fr.missions.filter((m) => /^\d+$/.test(m.badge));
    numbered.forEach((m, i) => assert.equal(Number(m.badge), i, m.id));
  });

  it("le sous-titre annonce le bon nombre de missions (hors briefing et diplôme)", () => {
    const playable = MISSION_FLOW.filter((id) => id !== "intro" && id !== "done").length;
    for (const c of all) assert.equal(firstInt(c.subtitle), playable);
  });

  it("progressLabel et diceLeft produisent des libellés cohérents", () => {
    for (const c of all) {
      assert.deepEqual(allInts(c.progressLabel(3, 8)), [3, 8]);
      assert.deepEqual(allInts(c.goal.diceLeft(1)), [1]);
      assert.deepEqual(allInts(c.goal.diceLeft(5)), [5]);
    }
    // Pluriel distinct en français et en anglais (en allemand, « 1 Würfel » / « 2 Würfel »).
    for (const c of [fr, en]) {
      assert.notEqual(c.goal.diceLeft(1).replace("1", "N"), c.goal.diceLeft(2).replace("2", "N"), "pluriel");
    }
  });

  it("chasse aux zones : zones existantes, distinctes, nombre annoncé = nombre de questions", () => {
    for (const c of all) {
      const zones = c.board.prompts.map((p) => p.zone);
      assert.equal(new Set(zones).size, zones.length);
      for (const z of zones) assert.ok(zoneIds.has(z), `zone inconnue ${z}`);
      assert.equal(firstInt(c.board.challenge), zones.length);
    }
  });

  it("rôles des cartes : carte existante, libellé = type réel, les 4 types couverts", () => {
    LOCALES.forEach((locale, index) => {
      const c = all[index];
      for (const role of c.cards.roles) {
        assert.ok(role.key in EXAMPLE_CARDS);
        assert.ok(typeNames(locale, EXAMPLE_CARDS[role.key].type).includes(role.typeLabel), `${locale} ${role.typeLabel}`);
      }
      const types = new Set(c.cards.roles.map((r) => r.typeLabel));
      assert.equal(types.size, 4);
      assert.equal(firstInt(c.cards.challenge), c.cards.roles.length);
      assert.equal(firstInt(c.cards.title), c.cards.roles.length);
    });
  });

  it("étapes du tour : ids uniques, numérotation 1..n, Start Phase dans l'ordre Ready → Pioche → Gig", () => {
    for (const c of all) {
      const ids = c.turn.steps.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length);
      c.turn.steps.forEach((s, i) => assert.equal(firstInt(s.title), i + 1, s.title));
      assert.deepEqual(ids.slice(0, 3), ["ready", "draw", "gig"]);
    }
  });

  it("chaque question (combat + quiz) a exactement une bonne réponse et des choix uniques", () => {
    for (const c of all) {
      const all = [...c.combat.scenarios, ...c.quiz.questions];
      const ids = [...c.combat.scenarios.map((s) => s.id), ...c.quiz.questions.map((q) => q.id)];
      assert.equal(new Set(ids).size, ids.length);
      for (const q of all) {
        assert.ok(q.choices.length >= 2, q.id);
        assert.equal(q.choices.filter((ch) => ch.correct).length, 1, `${q.id} : une seule bonne réponse`);
        assert.equal(new Set(q.choices.map((ch) => ch.id)).size, q.choices.length);
        assert.equal(new Set(q.choices.map((ch) => ch.label)).size, q.choices.length);
      }
    }
  });

  it("quiz : nombre de questions annoncé exact, seuil de réussite atteignable", () => {
    for (const c of all) {
      const [count, threshold] = allInts(c.quiz.explain);
      assert.equal(count, c.quiz.questions.length);
      assert.ok(threshold > 0 && threshold <= count);
      assert.deepEqual(allInts(c.quiz.scoreLine(4, 5)), [4, 5]);
    }
  });

  it("scénario de vol : la bonne réponse vole le nombre de Gigs dicté par la Power", () => {
    for (const c of all) {
      const scenario = c.combat.scenarios.find((s) => s.id === "steal");
      assert.ok(scenario);
      const power = Number(scenario.setup.match(/Power (\d+)/)?.[1]);
      assert.equal(power, EXAMPLE_CARDS.unitSmasher.power);
      const good = scenario.choices.find((ch) => ch.correct)!;
      assert.equal(firstInt(good.label), gigsStolen(power));
    }
  });

  it("quiz Power → Gigs : la bonne réponse suit la règle de vol", () => {
    for (const c of all) {
      const q = c.quiz.questions.find((x) => /Power \d+/.test(x.prompt) && x.choices.every((ch) => /^\d+$/.test(ch.label)));
      assert.ok(q, "question Power introuvable");
      const power = Number(q.prompt.match(/Power (\d+)/)![1]);
      for (const ch of q.choices) assert.equal(ch.correct, Number(ch.label) === gigsStolen(power), ch.label);
    }
  });

  it("l’intro liste les 6 dés du Fixer, d4 à d20", () => {
    for (const c of all) {
      const dice = c.intro.needItems.join(" ").match(/d\d+/g);
      assert.deepEqual(dice, ["d4", "d6", "d8", "d10", "d12", "d20"]);
    }
  });
});
