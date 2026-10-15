/**
 * Contenus de règles d'une langue, reconstruits comme à l'exécution : blocs rules/*.json de la langue,
 * complétés par l'anglais puis le français, et formatage ICU par next-intl.
 */
import fs from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import type { Locale } from "../../src/i18n/config";
import { mergeMessages, type Messages } from "../../src/i18n/load";
import { anatomyCopy } from "../../src/lib/rules/card-anatomy";
import { buildInteractiveSteps, demoTableCopy } from "../../src/lib/rules/demo-match";
import type { EXAMPLE_CARDS } from "../../src/lib/rules/examples";
import { howtoPlayContent } from "../../src/lib/rules/howto-play";
import { tutorialCopy } from "../../src/lib/rules/tutorial";

const ROOT = path.join(__dirname, "../../src/i18n/messages");
const BLOCKS = ["anatomy", "demoMatch", "examples", "howToPlay", "tutorial"] as const;

function readRules(locale: string): Record<string, unknown> | undefined {
  const dir = path.join(ROOT, locale, "rules");
  if (!fs.existsSync(dir)) return undefined;
  return Object.fromEntries(
    BLOCKS.filter((block) => fs.existsSync(path.join(dir, `${block}.json`))).map((block) => [
      block,
      JSON.parse(fs.readFileSync(path.join(dir, `${block}.json`), "utf8")),
    ]),
  );
}

export function rulesMessages(locale: Locale): Messages["rules"] {
  return mergeMessages(readRules("fr"), readRules("en"), readRules(locale)) as Messages["rules"];
}

function translator(locale: Locale) {
  return createTranslator({ locale, messages: { rules: rulesMessages(locale) } as never }) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
}

export function howtoFor(locale: Locale) {
  return howtoPlayContent(rulesMessages(locale).howToPlay);
}

export function tutorialFor(locale: Locale) {
  const t = translator(locale);
  return tutorialCopy(rulesMessages(locale).tutorial, (key, values) => t(`rules.tutorial.${key}`, values));
}

export function stepsFor(locale: Locale) {
  return buildInteractiveSteps(rulesMessages(locale).demoMatch.steps);
}

export function tableFor(locale: Locale) {
  const t = translator(locale);
  return demoTableCopy(rulesMessages(locale).demoMatch.table, (key, values) => t(`rules.demoMatch.table.${key}`, values));
}

export function anatomyFor(locale: Locale) {
  return anatomyCopy(rulesMessages(locale).anatomy);
}

export function noteFor(locale: Locale, key: keyof typeof EXAMPLE_CARDS): string {
  return (rulesMessages(locale).examples.notes as Record<string, string>)[key];
}
