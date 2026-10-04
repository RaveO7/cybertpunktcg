/** Example cards used on the how-to-play page (local /card-images from the official catalog). */

export type ExampleCard = {
  name: string;
  type: "Legend" | "Unit" | "Program" | "Gear";
  imagePath: string;
  cost?: number | null;
  power?: number | null;
  href: string;
  noteFr: string;
  noteEn: string;
};

export const EXAMPLE_CARDS = {
  legendJackie: {
    name: "Jackie Welles: Mama's Favorite",
    type: "Legend",
    imagePath: "/card-images/9f61ebda-53fd-4b23-8383-d0e0bd32b847.webp",
    href: "/cards?q=Jackie+Welles%3A+Mama%27s+Favorite",
    noteFr: "Legend avec Go Solo — peut entrer sur le Field comme Unit.",
    noteEn: "Legend with Go Solo — can enter the Field as a Unit.",
  },
  legendJohnny: {
    name: "Johnny Silverhand: Rocking Renegade",
    type: "Legend",
    imagePath: "/card-images/a8a7d286-0c66-4f01-aca7-45570474d9e4.webp",
    href: "/cards?q=Johnny+Silverhand%3A+Rocking+Renegade",
    noteFr: "Legend face visible dans la zone Legends.",
    noteEn: "Face-up Legend in the Legends area.",
  },
  legendJudy: {
    name: "Judy Álvarez: Braindance Maestro",
    type: "Legend",
    imagePath: "/card-images/8d0ad645-ac9a-4ecb-93d0-4c2061a4c477.webp",
    href: "/cards?q=Judy+%C3%81lvarez%3A+Braindance+Maestro",
    noteFr: "Legend bleu — booste les Programs BRAINDANCE.",
    noteEn: "Blue Legend — boosts BRAINDANCE Programs.",
  },
  unitJackie: {
    name: "Jackie Welles: Ride or Die Choom",
    type: "Unit",
    imagePath: "/card-images/12d44604-ad7b-4e82-b517-9edb0be44427.webp",
    cost: 6,
    power: 8,
    href: "/cards?q=Jackie+Welles%3A+Ride+or+Die+Choom",
    noteFr: "Unit sur le Field — attaque et vole des Gigs.",
    noteEn: "Unit on the Field — attacks and steals Gigs.",
  },
  unitBlocker: {
    name: "Meredith Stout: Stone Cold Corpo",
    type: "Unit",
    imagePath: "/card-images/5939771d-bdcc-4b42-aea4-376311189e93.webp",
    cost: 4,
    power: 5,
    href: "/cards?q=Meredith+Stout",
    noteFr: "Unit avec Blocker — redirige une attaque.",
    noteEn: "Unit with Blocker — redirects an attack.",
  },
  unitAdrenaline: {
    name: "Riding Nomad",
    type: "Unit",
    imagePath: "/card-images/1ee3ba07-86b0-4309-be55-4b4698f700b8.webp",
    cost: 5,
    power: 4,
    href: "/cards?q=Riding+Nomad",
    noteFr: "Adrenaline — peut attaquer le tour où elle est jouée.",
    noteEn: "Adrenaline — can attack the turn it’s played.",
  },
  unitSmasher: {
    name: "Adam Smasher: Metal Over Meat",
    type: "Unit",
    imagePath: "/card-images/d23e322f-ad60-431d-b33e-1e8a813248ff.webp",
    cost: 9,
    power: 15,
    href: "/cards?q=Adam+Smasher%3A+Metal+Over+Meat",
    noteFr: "Power 15 → vole 2 Gigs en attaquant la zone Gig.",
    noteEn: "Power 15 → steals 2 Gigs when attacking the Gig area.",
  },
  programDetonate: {
    name: "Detonate",
    type: "Program",
    imagePath: "/card-images/bec995b7-b76b-4605-9c36-3d7697cdd4f5.webp",
    cost: 1,
    href: "/cards?q=Detonate",
    noteFr: "Program Quick — jouable en réaction à une attaque.",
    noteEn: "Quick Program — playable as a reaction to an attack.",
  },
  programReaper: {
    name: "(Don't Fear) The Reaper",
    type: "Program",
    imagePath: "/card-images/e96d3167-5115-4c82-9b35-546cba0aaead.webp",
    cost: 7,
    href: "/cards?q=%28Don%27t+Fear%29+The+Reaper",
    noteFr: "Program — effet immédiat, puis Trash.",
    noteEn: "Program — instant effect, then Trash.",
  },
  gearConverter: {
    name: "Adrenaline Converter",
    type: "Gear",
    imagePath: "/card-images/535df2a9-d2af-463c-85dd-dafe67cab8fb.webp",
    cost: 2,
    power: 3,
    href: "/cards?q=Adrenaline+Converter",
    noteFr: "Gear — s’équipe sur une Unit ou Legend.",
    noteEn: "Gear — equips to a Unit or Legend.",
  },
  eddieFace: {
    name: "Afterparty at Lizzie's",
    type: "Program",
    imagePath: "/card-images/d53925ee-df55-4b71-8ca0-13ec3ede2076.webp",
    cost: 1,
    href: "/cards?q=Afterparty+at+Lizzie%27s",
    noteFr: "Vendue face cachée = 1 Eddie dans la zone Eddies.",
    noteEn: "Sold face-down = 1 Eddie in the Eddies area.",
  },
} as const satisfies Record<string, ExampleCard>;

export type PlaymatZoneId =
  | "fixer"
  | "rivalGig"
  | "gig"
  | "field"
  | "eddies"
  | "legends"
  | "deck"
  | "trash";
