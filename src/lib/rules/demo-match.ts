import { EXAMPLE_CARDS, type ExampleCard } from "@/lib/rules/examples";
import type { Messages } from "@/i18n/load";
import type { CardRef } from "@/lib/rules/demo-match-state";
import type { ExpectAction } from "@/lib/rules/demo-match-steps";

/** Textes de la table de jeu dans une langue (bloc rules.demoMatch.table). */
export type DemoTableText = Messages["rules"]["demoMatch"]["table"];

/** Messages avec variables de la table, formatés par next-intl (clés relatives au bloc rules.demoMatch.table). */
export type DemoTableFormat = (key: "fx.streetCred" | "turnYou" | "turnRival", values: Record<string, string | number>) => string;

export function demoTableCopy(text: DemoTableText, format: DemoTableFormat) {
  return {
    ...text,
    fx: { ...text.fx, streetCred: (face: string) => format("fx.streetCred", { face }) },
    turnYou: (n: number) => format("turnYou", { n }),
    turnRival: (n: number) => format("turnRival", { n }),
  };
}

export type DemoTableCopy = ReturnType<typeof demoTableCopy>;

export function cardOf(ref: CardRef): ExampleCard {
  return EXAMPLE_CARDS[ref];
}

export function matchesExpect(
  expect: ExpectAction,
  action:
    | { type: "begin" }
    | { type: "die"; die: string }
    | { type: "hand"; card: CardRef }
    | { type: "field"; ref: CardRef; id: string }
    | { type: "target-gigs" }
    | { type: "target-rival"; ref: CardRef }
    | { type: "end-turn" }
    | { type: "continue" }
    | { type: "eddie" }
    | { type: "legend" }
    | { type: "call-legend" }
    | { type: "done" },
): boolean {
  switch (expect.kind) {
    case "begin":
      return action.type === "begin";
    case "die":
      return action.type === "die" && action.die === expect.die;
    case "hand":
      return action.type === "hand" && action.card === expect.card;
    case "field":
      return action.type === "field" && action.ref === expect.ref;
    case "target-gigs":
      return action.type === "target-gigs";
    case "target-rival":
      return action.type === "target-rival" && (expect.ref == null || action.ref === expect.ref);
    case "end-turn":
      return action.type === "end-turn";
    case "continue":
      return action.type === "continue";
    case "eddie":
      return action.type === "eddie";
    case "legend":
      return action.type === "legend";
    case "call-legend":
      return action.type === "call-legend";
    case "done":
      return action.type === "done";
    default:
      return false;
  }
}
