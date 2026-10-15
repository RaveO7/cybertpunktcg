import type { Messages } from "@/i18n/load";
import { EXAMPLE_CARDS } from "@/lib/rules/examples";

export type AnatomyPartId =
  | "cost"
  | "sell"
  | "type"
  | "ram"
  | "art"
  | "name"
  | "classes"
  | "keyword"
  | "text"
  | "power"
  | "set"
  | "illustrator";

/** Marker positions are percentages of the card image (733×1024 official scans). */
export type AnatomyPoint = {
  part: AnatomyPartId;
  x: number;
  y: number;
  /** Which side the callout label sits on (official guide style). */
  side: "left" | "right";
};

export type AnatomyCard = {
  id: "unit" | "program" | "legend";
  exampleKey: keyof typeof EXAMPLE_CARDS;
  points: AnatomyPoint[];
};

/**
 * Layout mirrors the official Card Anatomy diagram on cyberpunktcg.com/gameplay-guide:
 * left callouts ← yellow leader lines ← card → lines → right callouts.
 */
export const ANATOMY_CARDS: AnatomyCard[] = [
  {
    id: "unit",
    exampleKey: "unitJackie",
    points: [
      { part: "cost", x: 12, y: 9, side: "left" },
      { part: "type", x: 88, y: 5.7, side: "right" },
      { part: "ram", x: 87, y: 12, side: "right" },
      { part: "name", x: 32, y: 62, side: "left" },
      { part: "classes", x: 26, y: 69.6, side: "left" },
      { part: "text", x: 50, y: 80, side: "left" },
      { part: "illustrator", x: 95.5, y: 55, side: "right" },
      { part: "power", x: 88.5, y: 91.8, side: "right" },
      { part: "set", x: 5, y: 88, side: "left" },
    ],
  },
  {
    id: "program",
    exampleKey: "eddieFace",
    points: [
      { part: "cost", x: 12, y: 8.6, side: "left" },
      { part: "sell", x: 13, y: 19, side: "left" },
      { part: "type", x: 83, y: 5.7, side: "right" },
      { part: "ram", x: 87, y: 12, side: "right" },
      { part: "name", x: 50, y: 72.8, side: "left" },
      { part: "classes", x: 26, y: 78, side: "left" },
      { part: "text", x: 50, y: 84.5, side: "left" },
      { part: "set", x: 5, y: 88, side: "left" },
      { part: "illustrator", x: 95.5, y: 55, side: "right" },
    ],
  },
  {
    id: "legend",
    exampleKey: "legendJackie",
    points: [
      { part: "cost", x: 12, y: 9, side: "left" },
      { part: "sell", x: 13, y: 19, side: "left" },
      { part: "type", x: 84, y: 5.7, side: "right" },
      { part: "ram", x: 87, y: 12, side: "right" },
      { part: "name", x: 50, y: 13, side: "left" },
      { part: "classes", x: 15.7, y: 62, side: "left" },
      { part: "keyword", x: 25, y: 66.4, side: "left" },
      { part: "text", x: 50, y: 82, side: "left" },
      { part: "illustrator", x: 95.5, y: 42, side: "right" },
      { part: "power", x: 88.5, y: 92.3, side: "right" },
    ],
  },
];

export type AnatomyCopy = {
  title: string;
  intro: string;
  hint: string;
  cards: Record<AnatomyCard["id"], { tab: string; caption: string }>;
  parts: Record<AnatomyPartId, { name: string; body: string }>;
  legendOverrides: Partial<Record<AnatomyPartId, string>>;
};

/** Textes de l'anatomie d'une carte dans une langue (bloc rules.anatomy). */
export function anatomyCopy(text: Messages["rules"]["anatomy"]): AnatomyCopy {
  return text as AnatomyCopy;
}
