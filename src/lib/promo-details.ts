// Fiches des cartes Cardmarket absentes de netdeck, relevées sur exburst.dev (séries ALPHA et PROMO), images
// copiées dans public/card-images. Clé : id produit Cardmarket. Les produits sans fiche (Lucyna de l'Alpha,
// 2ᵉ versions de Jackie, V et Viktor) gardent leur id produit comme numéro et n'ont pas d'image.
import type { PromoDetails } from "./cardmarket-promos";

export const PROMO_DETAILS: Readonly<Record<number, PromoDetails>> = {
  // Set 1 Promos : « Jackie & V — Chooms to the End » (exburst N000).
  924040: {
    collectorNumber: "N000",
    imagePath: "/card-images/promo-n000.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/N000_fx_1773105864012.webp",
    rulesText: null,
    card: { cardType: "Legend", color: "Yellow", cost: 5, power: 26, ram: 2 },
  },
  // Alpha : « Lucyna Kushinada — Fresh Beginnings », même promo que Set 1 Promos 004a (visuel netdeck).
  904914: {
    collectorNumber: "904914",
    imagePath: "/card-images/9b4231da-b5e9-44ee-9de9-75ba6a6e6de6.webp",
    sourceImageUrl:
      "https://dstcynss47vun.cloudfront.net/prod/cyberpunk/portal/9b4231da-b5e9-44ee-9de9-75ba6a6e6de6/render-msyiij67.webp",
    rulesText: null,
    card: { cardType: "Legend", color: "Blue", cost: null, power: null, ram: 2 },
  },
  // Alpha (exburst A001–A031).
  904915: {
    collectorNumber: "A001",
    imagePath: "/card-images/alpha-a001.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a001.webp",
    rulesText:
      "The first time a friendly Arasaka unit attacks each turn, draw a card. Then, if you have less than 20 ☆ (Street Cred), discard 1 card from your hand to your trash.",
    card: { cardType: "Legend", color: "Red", cost: 2, power: 0, ram: 2 },
  },
  904916: {
    collectorNumber: "A002",
    imagePath: "/card-images/alpha-a002.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a002.webp",
    rulesText:
      "The first time you play a blue unit or blue gear each turn, you may increase a friendly gig by 2. Then, if it's at max value, draw a card.",
    card: { cardType: "Legend", color: "Blue", cost: 2, power: 0, ram: 2 },
  },
  904917: {
    collectorNumber: "A003",
    imagePath: "/card-images/alpha-a003.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a003.webp",
    rulesText:
      "GO SOLO (Pay this card's cost to play it as a ready unit. It can attack this turn.)",
    card: { cardType: "Legend", color: "Blue", cost: 5, power: 8, ram: 2 },
  },
  904919: {
    collectorNumber: "A004",
    imagePath: "/card-images/alpha-a004.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a004.webp",
    rulesText:
      "GO SOLO (Pay this card's cost to play it as a ready unit. It can attack this turn.) BLOCKER (When a rival units attacks, you may spend this unit to redirect the attack to this unit.)",
    card: { cardType: "Legend", color: "Green", cost: 5, power: 7, ram: 2 },
  },
  904922: {
    collectorNumber: "A005",
    imagePath: "/card-images/alpha-a005.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a005.webp",
    rulesText:
      "Your Arasaka units have +1 power when attacking. (Units steal an extra gig for every 10 power.)",
    card: { cardType: "Legend", color: "Green", cost: 2, power: 0, ram: 2 },
  },
  904925: {
    collectorNumber: "A006",
    imagePath: "/card-images/alpha-a006.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a006.webp",
    rulesText:
      "{Flip} Search the top 5 cards of your deck for up yo 2 gear that costs 2 or less each. Reveal them and add them to your hand. (Place the other cards on the bottom of your deck in a random order.)",
    card: { cardType: "Legend", color: "Yellow", cost: 2, power: 0, ram: 2 },
  },
  904929: {
    collectorNumber: "A007",
    imagePath: "/card-images/alpha-a007.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a007.webp",
    rulesText:
      "{Play} If you have 12+ ☆ (Street Cred), defeat a rival unit with power 5 or less.",
    card: { cardType: "Unit", color: "Red", cost: 6, power: 9, ram: 4 },
  },
  904932: {
    collectorNumber: "A008",
    imagePath: "/card-images/alpha-a008.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a008.webp",
    rulesText:
      "When a rival steals one or more friendly gigs, if this unit is spent, the value of those gigs becomes 1.",
    card: { cardType: "Unit", color: "Red", cost: 2, power: 1, ram: 1 },
  },
  904934: {
    collectorNumber: "A009",
    imagePath: "/card-images/alpha-a009.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a009.webp",
    rulesText: null,
    card: { cardType: "Unit", color: "Red", cost: 3, power: 5, ram: 1 },
  },
  904935: {
    collectorNumber: "A010",
    imagePath: "/card-images/alpha-a010.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a010.webp",
    rulesText: null,
    card: { cardType: "Unit", color: "Blue", cost: 4, power: 7, ram: 3 },
  },
  904936: {
    collectorNumber: "A011",
    imagePath: "/card-images/alpha-a011.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a011.webp",
    rulesText:
      "When a rival steals one or more friendly gigs, if this unit is spent, draw a card.",
    card: { cardType: "Unit", color: "Blue", cost: 2, power: 1, ram: 1 },
  },
  904937: {
    collectorNumber: "A012",
    imagePath: "/card-images/alpha-a012.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a012.webp",
    rulesText: "If you have 7+ ☆ (Street Cred), this unit can't be blocked.",
    card: { cardType: "Unit", color: "Blue", cost: 5, power: 5, ram: 3 },
  },
  904938: {
    collectorNumber: "A013",
    imagePath: "/card-images/alpha-a013.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a013.webp",
    rulesText:
      "This unit has +2 power for each of your friendly gigs. (Units steal an extra gig for every 10 power.)",
    card: { cardType: "Unit", color: "Yellow", cost: 6, power: 6, ram: 3 },
  },
  904939: {
    collectorNumber: "A014",
    imagePath: "/card-images/alpha-a014.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a014.webp",
    rulesText:
      "This unit can't attack. BLOCKER (When a rival unit attacks, you may spend this unit to redirect the attack to it.)",
    card: { cardType: "Unit", color: "Yellow", cost: 2, power: 2, ram: 1 },
  },
  904940: {
    collectorNumber: "A015",
    imagePath: "/card-images/alpha-a015.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a015.webp",
    rulesText: null,
    card: { cardType: "Unit", color: "Yellow", cost: 3, power: 5, ram: 1 },
  },
  904941: {
    collectorNumber: "A016",
    imagePath: "/card-images/alpha-a016.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a016.webp",
    rulesText:
      "This unit can't attack. BLOCKER (When a rival unit attacks, you may spend this unit to redirect the attack to it.)",
    card: { cardType: "Unit", color: "Green", cost: 2, power: 2, ram: 2 },
  },
  904942: {
    collectorNumber: "A017",
    imagePath: "/card-images/alpha-a017.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a017.webp",
    rulesText: null,
    card: { cardType: "Unit", color: "Green", cost: 4, power: 7, ram: 3 },
  },
  904943: {
    collectorNumber: "A018",
    imagePath: "/card-images/alpha-a018.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a018.webp",
    rulesText:
      "This unit has +1 power during your turn for each face-up legend in your legends area.",
    card: { cardType: "Unit", color: "Green", cost: 4, power: 5, ram: 3 },
  },
  904945: {
    collectorNumber: "A019",
    imagePath: "/card-images/alpha-a019.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a019.webp",
    rulesText: "(Equip to a unit or face-up legend.)",
    card: { cardType: "Gear", color: "Red", cost: 1, power: 2, ram: 1 },
  },
  904947: {
    collectorNumber: "A020",
    imagePath: "/card-images/alpha-a020.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a020.webp",
    rulesText:
      "(Equip to a unit or face-up legend.) {Attack} If this unit wins a fight against a rival unit, draw a card.",
    card: { cardType: "Gear", color: "Red", cost: 2, power: 1, ram: 2 },
  },
  904949: {
    collectorNumber: "A021",
    imagePath: "/card-images/alpha-a021.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a021.webp",
    rulesText:
      "Increase a friendly gig by 4. Then, if you have 7+ ☆ (Street Cred), draw a card. (Discard programs after they resolve.)",
    card: { cardType: "Program", color: "Red", cost: 2, power: null, ram: 1 },
  },
  904952: {
    collectorNumber: "A022",
    imagePath: "/card-images/alpha-a022.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a022.webp",
    rulesText:
      "(Equip to a unit or face-up legend.) {Attack} If you have 7+ ☆ (Street Cred), defeat a rival gear card that costs 2 or less.",
    card: { cardType: "Gear", color: "Blue", cost: 2, power: 2, ram: 3 },
  },
  904953: {
    collectorNumber: "A023",
    imagePath: "/card-images/alpha-a023.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a023.webp",
    rulesText:
      "Return a spent unit with cost 4 or less to its owner's hand. (Discard programs after they resolve.)",
    card: { cardType: "Program", color: "Blue", cost: 3, power: null, ram: 2 },
  },
  904955: {
    collectorNumber: "A024",
    imagePath: "/card-images/alpha-a024.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a024.webp",
    rulesText:
      "(Equip to a unit or face-up legend.) PLAY This unit can attack spent units this turn.",
    card: { cardType: "Gear", color: "Green", cost: 3, power: 3, ram: 4 },
  },
  904958: {
    collectorNumber: "A025",
    imagePath: "/card-images/alpha-a025.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a025.webp",
    rulesText:
      "Spend a rival unit with cost 3 or less. (Discard programs after they resolve.)",
    card: { cardType: "Program", color: "Green", cost: 2, power: null, ram: 2 },
  },
  904961: {
    collectorNumber: "A026",
    imagePath: "/card-images/alpha-a026.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a026.webp",
    rulesText:
      "(Equip to a unit or face-up legend.) {Attack} Look at a friendly face-down legend without revealing it.",
    card: { cardType: "Gear", color: "Yellow", cost: 1, power: 1, ram: 1 },
  },
  904962: {
    collectorNumber: "A027",
    imagePath: "/card-images/alpha-a027.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a027.webp",
    rulesText:
      "(Equip to a unit or face-up legend.) BLOCKER (When a rival unit attacks, you may spend this unit to redirect the attack to it.)",
    card: { cardType: "Gear", color: "Yellow", cost: 1, power: 0, ram: 2 },
  },
  904965: {
    collectorNumber: "A028",
    imagePath: "/card-images/alpha-a028.webp",
    sourceImageUrl: "https://cdn.exburst.dev/cards/cyberpunk/a028.webp",
    rulesText:
      "Give a friendly unit +4 power this turn. Defeat it at the end of the turn. (Discard programs after they resolve.)",
    card: {
      cardType: "Program",
      color: "Yellow",
      cost: 2,
      power: null,
      ram: 2,
    },
  },
  904968: {
    collectorNumber: "A029",
    imagePath: "/card-images/alpha-a029.webp",
    sourceImageUrl:
      "https://cdn.exburst.dev/cards/cyberpunk/69675c6c8b5e9ad6eb87a342_a029.webp",
    rulesText:
      "Your Arasaka units have +1 power when attacking. (Units steal an extra gig for every 10 power.)",
    card: { cardType: "Legend", color: "Green", cost: 2, power: 0, ram: 2 },
  }, // variante de A005
  904970: {
    collectorNumber: "A030",
    imagePath: "/card-images/alpha-a030.webp",
    sourceImageUrl:
      "https://cdn.exburst.dev/cards/cyberpunk/69675c6c8b5e9ad6eb87a343_a030.webp",
    rulesText:
      "GO SOLO (Pay this card's cost to play it as a ready unit. It can attack this turn.) BLOCKER (When a rival units attacks, you may spend this unit to redirect the attack to this unit.)",
    card: { cardType: "Legend", color: "Green", cost: 5, power: 7, ram: 2 },
  }, // variante de A004
  904975: {
    collectorNumber: "A031",
    imagePath: "/card-images/alpha-a031.webp",
    sourceImageUrl:
      "https://cdn.exburst.dev/cards/cyberpunk/69675c6c8b5e9ad6eb87a344_a031.webp",
    rulesText:
      "The first time a friendly Arasaka unit attacks each turn, draw a card. Then, if you have less than 20 ☆ (Street Cred), discard 1 card from your hand to your trash.",
    card: { cardType: "Legend", color: "Red", cost: 2, power: 0, ram: 2 },
  }, // variante de A001
};
