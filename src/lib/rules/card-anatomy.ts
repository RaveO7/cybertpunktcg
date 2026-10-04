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

const fr: AnatomyCopy = {
  title: "Lire une carte",
  intro:
    "Toutes les cartes partagent la même structure. Survolez ou cliquez un repère pour lire l’explication reliée à la carte.",
  hint: "Choisissez un type de carte :",
  cards: {
    unit: { tab: "Unit", caption: "Jackie Welles: Ride or Die Choom" },
    program: { tab: "Program (sell tag)", caption: "Afterparty at Lizzie's" },
    legend: { tab: "Legend", caption: "Jackie Welles: Mama's Favorite" },
  },
  parts: {
    cost: {
      name: "Coût",
      body: "Spendez autant d’Eddies que ce chiffre pour jouer la carte. (Vous pouvez aussi spender des Legends face visible ou cachée à 1 €$ chacune.)",
    },
    sell: {
      name: "Sell tag",
      body: "Vous pouvez vendre les cartes avec ce symbole pour des Eddies. Une Legend avec sell tag peut aussi payer 1 €$ dans la zone Legends.",
    },
    type: {
      name: "Type",
      body: "Indique si la carte est une Legend, Unit, Program ou Gear.",
    },
    ram: {
      name: "RAM",
      body: "La RAM cumulée et la couleur de vos Legends déterminent quelles autres cartes peuvent entrer dans votre deck.",
    },
    art: {
      name: "Illustration",
      body: "L’artwork de la carte. La couleur du cadre rappelle la couleur de RAM.",
    },
    name: {
      name: "Nom",
      body: "Nom de la carte, avec parfois un sous-titre. Maximum 3 exemplaires d’une même carte ; vos 3 Legends doivent avoir des noms uniques.",
    },
    classes: {
      name: "Tags",
      body: "Affiliations de la carte (Merc, Valentino, Braindance…). Elles peuvent être référencées par des effets.",
    },
    keyword: {
      name: "Mot-clé",
      body: "Effet standard (Go Solo, Adrenaline, Quick, Blocker). L’explication est souvent rappelée entre parenthèses.",
    },
    text: {
      name: "Texte d’effet",
      body: "Ce que fait la carte. Les timing triggers (Play, Call, Attack, Defeated) disent quand l’effet se déclenche. En cas de conflit, le texte de la carte prime.",
    },
    power: {
      name: "Power",
      body: "Utilisée en attaque. Détermine le succès en combat contre une Unit adverse. Une Unit vole 2 Gigs à Power 10, 3 à 20, etc.",
    },
    set: {
      name: "Set & numéro",
      body: "Code de l’extension (MS01 – WNC) et numéro de collection, utiles pour retrouver la carte dans le catalogue.",
    },
    illustrator: {
      name: "Crédit artiste",
      body: "Nom de l’illustrateur, imprimé sur le bord de la carte.",
    },
  },
  legendOverrides: {
    cost: "Sur une Legend, c’est le coût à payer pour la jouer comme Unit via Go Solo. Sinon elle reste dans sa zone et peut payer 1 €$.",
    ram: "Sur une Legend, c’est la RAM qu’elle apporte à votre deck. Additionnez la RAM de vos 3 Legends par couleur pour vos limites de construction.",
    power: "Power utilisée si la Legend entre sur le Field en Go Solo.",
  },
};

const en: AnatomyCopy = {
  title: "Reading your cards",
  intro:
    "Every card shares the same layout. Hover or click a marker to read the explanation linked to the card.",
  hint: "Pick a card type:",
  cards: {
    unit: { tab: "Unit", caption: "Jackie Welles: Ride or Die Choom" },
    program: { tab: "Program (sell tag)", caption: "Afterparty at Lizzie's" },
    legend: { tab: "Legend", caption: "Jackie Welles: Mama's Favorite" },
  },
  parts: {
    cost: {
      name: "Cost",
      body: "Spend Eddies equal to a card’s cost to play it. (You can also spend face-up or face-down Legends as 1 €$ each.)",
    },
    sell: {
      name: "Sell tag",
      body: "You can sell cards with this symbol for Eddies. Legends with a sell tag can be spent to pay 1 €$ in the Legends area.",
    },
    type: {
      name: "Type",
      body: "Designates a card as a Legend, Unit, Program, or Gear.",
    },
    ram: {
      name: "RAM",
      body: "Your Legends’ cumulative RAM amount & color determines the other cards that can be included in your deck.",
    },
    art: {
      name: "Artwork",
      body: "The card art. The frame color matches the RAM color.",
    },
    name: {
      name: "Name",
      body: "Card name, sometimes with a subtitle. Up to 3 copies of the same card; your 3 Legends must have unique names.",
    },
    classes: {
      name: "Tags",
      body: "Designates a card’s affiliations. These can be referenced in effects.",
    },
    keyword: {
      name: "Keyword",
      body: "A standard effect (Go Solo, Adrenaline, Quick, Blocker). Reminder text often follows in parentheses.",
    },
    text: {
      name: "Effect text",
      body: "What the card does. Timing triggers (Play, Call, Attack, Defeated) tell you when the effect happens. If card text conflicts with the rules, follow the card.",
    },
    power: {
      name: "Power",
      body: "Used in attacking. Determines success in fights against rival Units. A Unit steals two Gigs at 10 power, three at 20, and so on.",
    },
    set: {
      name: "Set & number",
      body: "Expansion code (MS01 – WNC) and collector number, handy to find the card in the catalog.",
    },
    illustrator: {
      name: "Artist credit",
      body: "The illustrator’s name, printed along the card edge.",
    },
  },
  legendOverrides: {
    cost: "On a Legend, this is what you pay to play it as a Unit with Go Solo. Otherwise the Legend stays in its area and can pay 1 €$.",
    ram: "On a Legend, this is the RAM it grants your deck. Add up your 3 Legends’ RAM per color to get your deck-building limits.",
    power: "Power used if the Legend enters the Field with Go Solo.",
  },
};

export function anatomyCopy(locale: "fr" | "en"): AnatomyCopy {
  return locale === "fr" ? fr : en;
}
