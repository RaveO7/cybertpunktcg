import type { Messages } from "@/i18n/load";
import { withData } from "@/lib/rules/content";
import { EXAMPLE_CARDS, type PlaymatZoneId } from "@/lib/rules/examples";

export type RulesTerm = { term: string; definition: string };
export type RulesStep = { title: string; body: string };
export type RulesAction = { title: string; body: string };
export type RulesArea = { id: PlaymatZoneId; name: string; body: string; tips?: string[] };
export type RulesCardType = {
  name: string;
  body: string;
  exampleKey: keyof typeof EXAMPLE_CARDS;
};
export type RulesKeyword = {
  name: string;
  body: string;
  exampleKey?: keyof typeof EXAMPLE_CARDS;
};

/** Textes des règles détaillées dans une langue. */
export type HowToPlayText = Messages["rules"]["howToPlay"];

export type HowToPlayContent = {
  eyebrow: string;
  title: string;
  intro: string[];
  sourceLabel: string;
  sourceUrl: string;
  sourcePdfLabel: string;
  sourcePdfUrl: string;
  toc: { id: string; label: string }[];
  win: {
    title: string;
    body: string;
    highlight: string;
    highlightBody: string;
    overtime: string;
    overtimeBody: string;
    deckOut: string;
  };
  areas: {
    title: string;
    items: RulesArea[];
  };
  playmat: {
    hint: string;
    prev: string;
    next: string;
    fixer: string;
    rivalGig: string;
    gig: string;
    streetCred: string;
    legends: string;
    field: string;
    eddies: string;
    deck: string;
    trash: string;
  };
  cardTypes: {
    title: string;
    note: string;
    items: RulesCardType[];
  };
  examplesTitle: string;
  fightExample: {
    title: string;
    body: string;
    attackerLabel: string;
    defenderLabel: string;
    outcome: string;
  };
  stealExample: {
    title: string;
    body: string;
  };
  triggers: {
    title: string;
    intro: string;
    items: RulesKeyword[];
  };
  keywords: {
    title: string;
    intro: string;
    items: RulesKeyword[];
  };
  setup: {
    title: string;
    intro: string;
    steps: RulesStep[];
  };
  turn: {
    title: string;
    intro: string;
    startTitle: string;
    startSteps: RulesStep[];
    mainTitle: string;
    mainIntro: string;
    mainActions: RulesAction[];
  };
  attack: {
    title: string;
    intro: string;
    steps: RulesStep[];
    reactTitle: string;
    reactIntro: string;
    reactions: RulesAction[];
    fightTitle: string;
    fightBody: string[];
    stealTitle: string;
    stealBody: string;
    stealTiers: string[];
    tip: string;
  };
  deckbuilding: {
    title: string;
    intro: string;
    rules: string[];
    ramTitle: string;
    ramBody: string[];
  };
  glossary: {
    title: string;
    items: RulesTerm[];
  };
};

/** Données non traduisibles, alignées sur les textes du bloc rules.howToPlay (cf. withData). */
const HOWTO_DATA = {
  sourceUrl: "https://cyberpunktcg.com/gameplay-guide",
  sourcePdfUrl: "https://cyberpunktcg.com/docs/printable-gameplay-guide.pdf",
  toc: [
    { id: "victoire" },
    { id: "zones" },
    { id: "anatomie" },
    { id: "cartes" },
    { id: "mots-cles" },
    { id: "mise-en-place" },
    { id: "tour" },
    { id: "attaque" },
    { id: "deck" },
    { id: "glossaire" },
  ],
  areas: {
    items: [
      { id: "fixer" },
      { id: "rivalGig" },
      { id: "gig" },
      { id: "field" },
      { id: "eddies" },
      { id: "legends" },
      { id: "deck" },
      { id: "trash" },
    ],
  },
  cardTypes: {
    items: [
      { exampleKey: "legendJackie" },
      { exampleKey: "unitJackie" },
      { exampleKey: "programReaper" },
      { exampleKey: "gearConverter" },
    ],
  },
  triggers: { items: [null, null, { exampleKey: "unitJackie" }, null] },
  keywords: {
    items: [
      { exampleKey: "unitAdrenaline" },
      { exampleKey: "legendJackie" },
      { exampleKey: "programDetonate" },
      { exampleKey: "unitBlocker" },
    ],
  },
};

/** Règles détaillées à partir des textes d'une langue (bloc rules.howToPlay). */
export function howtoPlayContent(text: HowToPlayText): HowToPlayContent {
  return withData<HowToPlayContent>(text, HOWTO_DATA);
}
