"use client";

import { useMessages, useTranslations } from "next-intl";
import { useMemo } from "react";
import { anatomyCopy } from "@/lib/rules/card-anatomy";
import { buildInteractiveSteps, demoTableCopy } from "@/lib/rules/demo-match";
import { EXAMPLE_CARDS, type ExampleCard } from "@/lib/rules/examples";
import { howtoPlayContent } from "@/lib/rules/howto-play";
import { tutorialCopy } from "@/lib/rules/tutorial";

/**
 * Contenus de règles dans la langue de la page, à partir du bloc rules (transmis au navigateur par la
 * page des règles seulement) : contenus structurés lus tels quels, messages à variables formatés par
 * next-intl.
 */

function useRulesMessages() {
  return useMessages().rules;
}

export function useHowToPlayContent() {
  const rules = useRulesMessages();
  return useMemo(() => howtoPlayContent(rules.howToPlay), [rules]);
}

export function useTutorialCopy() {
  const rules = useRulesMessages();
  const format = useTranslations("rules.tutorial");
  return useMemo(() => tutorialCopy(rules.tutorial, (key, values) => format(key, values)), [rules, format]);
}

export function useDemoTableCopy() {
  const rules = useRulesMessages();
  const format = useTranslations("rules.demoMatch.table");
  return useMemo(() => demoTableCopy(rules.demoMatch.table, (key, values) => format(key, values)), [rules, format]);
}

export function useDemoSteps() {
  const rules = useRulesMessages();
  return useMemo(() => buildInteractiveSteps(rules.demoMatch.steps), [rules]);
}

export function useAnatomyCopy() {
  const rules = useRulesMessages();
  return useMemo(() => anatomyCopy(rules.anatomy), [rules]);
}

type ExampleKey = keyof typeof EXAMPLE_CARDS;
const EXAMPLE_KEYS = Object.keys(EXAMPLE_CARDS) as ExampleKey[];

/** Clé d'une carte d'exemple (même objet, sinon même nom), ou null. */
function exampleKeyOf(card: ExampleCard): ExampleKey | null {
  return EXAMPLE_KEYS.find((key) => EXAMPLE_CARDS[key] === card) ?? EXAMPLE_KEYS.find((key) => EXAMPLE_CARDS[key].name === card.name) ?? null;
}

/** Note traduite d'une carte d'exemple, par sa clé ou par la carte elle-même. */
export function useExampleNote() {
  const t = useTranslations("rules.examples.notes");
  return (card: ExampleKey | ExampleCard) => {
    const key = typeof card === "string" ? card : exampleKeyOf(card);
    return key ? t(key) : "";
  };
}
