import type { Messages } from "@/i18n/load";
import { withData } from "@/lib/rules/content";
import type { PlaymatZoneId } from "@/lib/rules/examples";
import { EXAMPLE_CARDS } from "@/lib/rules/examples";

export type QuizChoice = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type MissionId =
  | "intro"
  | "goal"
  | "board"
  | "cards"
  | "turn"
  | "combat"
  | "quiz"
  | "done";

export type TutorialCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  learnTab: string;
  rulesTab: string;
  startCta: string;
  continueCta: string;
  nextCta: string;
  backCta: string;
  skipCta: string;
  retryCta: string;
  hintCta: string;
  progressLabel: (current: number, total: number) => string;
  streetCred: string;
  correct: string;
  almost: string;
  missions: {
    id: MissionId;
    badge: string;
    title: string;
    blurb: string;
  }[];
  intro: {
    needTitle: string;
    needItems: string[];
    promise: string;
    tip: string;
  };
  goal: {
    title: string;
    explain: string;
    challenge: string;
    winLine: string;
    addGig: string;
    stealGig: string;
    fixerEmpty: string;
    reset: string;
    diceLeft: (n: number) => string;
    yourGigs: string;
  };
  board: {
    title: string;
    explain: string;
    challenge: string;
    prompts: { ask: string; zone: PlaymatZoneId; hint: string; success: string }[];
    foundAll: string;
  };
  cards: {
    title: string;
    explain: string;
    challenge: string;
    flipHint: string;
    roles: {
      key: keyof typeof EXAMPLE_CARDS;
      typeLabel: string;
      oneLiner: string;
      detail: string;
    }[];
    allSeen: string;
  };
  turn: {
    title: string;
    explain: string;
    challenge: string;
    steps: { id: string; title: string; body: string; action: string }[];
    done: string;
  };
  combat: {
    title: string;
    explain: string;
    scenarios: {
      id: string;
      setup: string;
      question: string;
      choices: QuizChoice[];
    }[];
    allClear: string;
  };
  quiz: {
    title: string;
    explain: string;
    questions: {
      id: string;
      prompt: string;
      choices: QuizChoice[];
    }[];
    scoreLine: (score: number, total: number) => string;
    pass: string;
    retry: string;
  };
  done: {
    title: string;
    body: string;
    restart: string;
    openRules: string;
    source: string;
  };
};

/** Données non traduisibles, alignées sur les textes du bloc rules.tutorial (cf. withData). */
const TUTORIAL_DATA = {
  missions: [
    { id: "intro" },
    { id: "goal" },
    { id: "board" },
    { id: "cards" },
    { id: "turn" },
    { id: "combat" },
    { id: "quiz" },
    { id: "done" },
  ],
  board: { prompts: [{ zone: "field" }, { zone: "eddies" }, { zone: "legends" }, { zone: "gig" }] },
  cards: {
    roles: [
      { key: "legendJackie" },
      { key: "unitJackie" },
      { key: "programReaper" },
      { key: "gearConverter" },
    ],
  },
  turn: {
    steps: [
      { id: "ready" },
      { id: "draw" },
      { id: "gig" },
      { id: "sell" },
      { id: "play" },
      { id: "attack" },
    ],
  },
  combat: {
    scenarios: [
      {
        id: "steal",
        choices: [{ id: "a", correct: true }, { id: "b", correct: false }, { id: "c", correct: false }],
      },
      {
        id: "fight",
        choices: [{ id: "a", correct: true }, { id: "b", correct: false }, { id: "c", correct: false }],
      },
      {
        id: "block",
        choices: [{ id: "a", correct: true }, { id: "b", correct: false }, { id: "c", correct: false }],
      },
    ],
  },
  quiz: {
    questions: [
      {
        id: "q1",
        choices: [{ id: "a", correct: false }, { id: "b", correct: true }, { id: "c", correct: false }],
      },
      {
        id: "q2",
        choices: [{ id: "a", correct: true }, { id: "b", correct: false }, { id: "c", correct: false }],
      },
      {
        id: "q3",
        choices: [{ id: "a", correct: false }, { id: "b", correct: true }, { id: "c", correct: false }],
      },
      {
        id: "q4",
        choices: [{ id: "a", correct: false }, { id: "b", correct: true }, { id: "c", correct: false }],
      },
      {
        id: "q5",
        choices: [{ id: "a", correct: false }, { id: "b", correct: false }, { id: "c", correct: true }],
      },
    ],
  },
};

/** Textes du parcours débutant dans une langue (bloc rules.tutorial). */
export type TutorialText = Messages["rules"]["tutorial"];

/** Messages avec variables du parcours, formatés par next-intl (clés relatives au bloc rules.tutorial). */
export type TutorialFormat = (key: "progressLabel" | "goal.diceLeft" | "quiz.scoreLine", values: Record<string, number>) => string;

export function tutorialCopy(text: TutorialText, format: TutorialFormat): TutorialCopy {
  type Merged = Omit<TutorialCopy, "progressLabel" | "goal" | "quiz"> & {
    goal: Omit<TutorialCopy["goal"], "diceLeft">;
    quiz: Omit<TutorialCopy["quiz"], "scoreLine">;
  };
  const merged = withData<Merged>(text, TUTORIAL_DATA);
  return {
    ...merged,
    progressLabel: (current, total) => format("progressLabel", { current, total }),
    goal: { ...merged.goal, diceLeft: (n) => format("goal.diceLeft", { n }) },
    quiz: { ...merged.quiz, scoreLine: (score, total) => format("quiz.scoreLine", { score, total }) },
  };
}

export const MISSION_FLOW: MissionId[] = [
  "intro",
  "goal",
  "board",
  "cards",
  "turn",
  "combat",
  "quiz",
  "done",
];
