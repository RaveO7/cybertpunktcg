import type { Locale } from "@/lib/i18n/messages";
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

const fr: HowToPlayContent = {
  eyebrow: "RÈGLES",
  title: "Comment jouer",
  intro: [
    "Dans le Cyberpunk Trading Card Game, vous dirigez votre propre crew face à un Rival pour devenir une légende de Night City. Remportez des Gigs, équipez vos Units, déployez des Programs et boostez votre Street Cred.",
    "Matériel : un jeu de six dés (d4, d6, d8, d10, d12, d20) et un deck Cyberpunk TCG. Objectif : contrôler la majorité des dés Gig et les sécuriser jusqu’au début de votre tour.",
  ],
  sourceLabel: "Guide officiel",
  sourceUrl: "https://cyberpunktcg.com/gameplay-guide",
  sourcePdfLabel: "PDF imprimable",
  sourcePdfUrl: "https://cyberpunktcg.com/docs/printable-gameplay-guide.pdf",
  toc: [
    { id: "victoire", label: "Victoire" },
    { id: "zones", label: "Zones" },
    { id: "anatomie", label: "Lire une carte" },
    { id: "cartes", label: "Types de cartes" },
    { id: "mots-cles", label: "Triggers & mots-clés" },
    { id: "mise-en-place", label: "Mise en place" },
    { id: "tour", label: "Tour de jeu" },
    { id: "attaque", label: "Attaque" },
    { id: "deck", label: "Construction de deck" },
    { id: "glossaire", label: "Glossaire" },
  ],
  win: {
    title: "Condition de victoire",
    body: "Contrôlez la majorité des Gigs de Night City, représentés par les dés Gig. Protégez les vôtres et attaquez votre Rival pour lui voler les siens. Chaque dé compte comme un Gig : deux dés rapprochent toujours plus de la victoire qu’un seul, même si la valeur affichée est plus faible.",
    highlight: "Commencez votre tour avec 7 Gigs pour gagner",
    highlightBody:
      "Si un joueur a au moins 7 dés Gig dans sa zone Gig au début de son tour, il gagne immédiatement.",
    overtime: "Prolongations : 7 Gigs = victoire instantanée",
    overtimeBody:
      "Les prolongations commencent après le 7e tour du dernier joueur. C’est une mort subite : dès qu’un joueur a la majorité des dés Gig, il gagne.",
    deckOut:
      "Deck out : si vous devez piocher et que votre deck est vide, votre Rival gagne immédiatement.",
  },
  areas: {
    title: "Zones du tapis",
    items: [
      {
        id: "fixer",
        name: "Fixer",
        body: "Tous vos dés Gig commencent ici. Au début de votre tour, après avoir pioché, choisissez un dé (sauf le d20, toujours en dernier), lancez-le, puis placez-le dans votre zone Gig.",
        tips: [
          "Les dés représentent les offres de jobs que votre fixer vous a trouvées.",
          "Petit dé = valeur faible mais sûre ; gros dé = plus de Street Cred potentielle.",
          "Le d20 ne peut être choisi qu’une fois tous les autres dés pris.",
        ],
      },
      {
        id: "rivalGig",
        name: "Gigs rivaux",
        body: "Les dés Gig contrôlés par votre Rival. C’est la cible de vos Units quand elles attaquent directement : chaque attaque réussie y prend un dé pour le déplacer dans votre zone Gigs alliés.",
        tips: [
          "Une Unit vole 1 Gig, +1 par tranche de 10 Power (Power 10+ → 2 Gigs).",
          "Si un Blocker redirige l’attaque, aucun Gig n’est volé, même si vous gagnez le combat.",
          "Surveillez son total : à 7 dés au début de son tour, votre Rival gagne.",
        ],
      },
      {
        id: "gig",
        name: "Gigs alliés",
        body: "Gigs que vous contrôlez, y compris ceux volés. Avoir 7 dés ici au début du tour (avant d’en prendre un au Fixer) fait gagner. La Street Cred est la somme des faces visibles de ces dés.",
        tips: [
          "Chaque dé = 1 Gig, quelle que soit sa valeur : c’est le nombre de dés qui fait gagner.",
          "Les Units adverses attaquent cette zone pour vous voler des dés.",
          "Certaines cartes exigent un seuil de ☆ Street Cred pour s’activer.",
        ],
      },
      {
        id: "field",
        name: "Field",
        body: "Zone des Units. Elles peuvent attaquer une Unit adverse spent pour engager un combat, ou la zone Gig adverse pour voler un Gig. Le Gear s’équipe ici sur une Unit.",
        tips: [
          "Les Units arrivent ready mais avec Lag : pas d’attaque le tour où elles sont jouées (sauf Adrenaline).",
          "Attaquer spend l’Unit (à l’horizontale) : elle devient attaquable par le Rival.",
          "Une Unit ready ne peut pas être attaquée ; seules Quick / Blocker interrompent une attaque.",
        ],
      },
      {
        id: "eddies",
        name: "Eddies (€$)",
        body: "La monnaie de Night City. Pour jouer une carte, dépensez autant d’Eddies que son coût (coin supérieur gauche). La zone commence vide : vendez des cartes de votre main pour créer des Eddies.",
        tips: [
          "Vente : 1×/tour, une carte avec sell tag (€$) → 1 Eddie face cachée.",
          "Payer = spender (tourner) les Eddies ; ils se redressent au début de votre tour.",
          "Une carte vendue vaut toujours 1 €$, même si elle coûtait 8.",
        ],
      },
      {
        id: "legends",
        name: "Legends",
        body: "Vos 3 Legends commencent face cachée, dans un ordre aléatoire. Une fois par tour, vous pouvez Call a Legend en dépensant 1 €$ pour en retourner une sans regarder. Face visible ou non, une Legend peut aussi servir de 1 €$.",
        tips: [
          "Call a Legend est aussi possible en réaction à une attaque adverse.",
          "Le premier joueur commence avec ses 2 Legends de gauche spent.",
          "Les Legends avec Go Solo peuvent entrer sur le Field comme Unit.",
        ],
      },
      {
        id: "deck",
        name: "Deck",
        body: "Piochez toujours depuis le dessus de votre deck.",
        tips: [
          "40 à 50 cartes, hors Legends.",
          "Deck out : si vous devez piocher avec un deck vide, votre Rival gagne.",
        ],
      },
      {
        id: "trash",
        name: "Trash",
        body: "Cartes défaussées, vaincues ou trashées, face visible.",
        tips: [
          "Les Programs y vont dès que leur effet est résolu.",
          "Une Unit vaincue y part avec tout son Gear équipé.",
        ],
      },
    ],
  },
  playmat: {
    hint: "Tapis interactif avec de vraies cartes du set Welcome to Night City, en milieu de partie. Survolez ou cliquez une zone pour lire son rôle.",
    prev: "Précédente",
    next: "Suivante",
    fixer: "Fixer",
    rivalGig: "Gigs rivaux",
    gig: "Gigs alliés",
    streetCred: "Street Cred = 4+6+10 = 20",
    legends: "Legends",
    field: "Field",
    eddies: "Eddies",
    deck: "Deck",
    trash: "Trash",
  },
  examplesTitle: "Exemple réel",
  fightExample: {
    title: "Exemple de combat",
    body: "Jackie (Unit) attaque Meredith (Unit spent adverse). On compare la Power : le plus haut vainc, égalité = les deux Trash.",
    attackerLabel: "Attaquant",
    defenderLabel: "Défenseur (spent)",
    outcome: "Si Jackie a plus de Power, Meredith part à la Trash avec son éventuel Gear.",
  },
  stealExample: {
    title: "Exemple de vol de Gig",
    body: "Adam Smasher: Metal Over Meat a Power 15. S’il attaque la zone Gig adverse sans être bloqué, il vole 2 Gigs (seuil 10+).",
  },
  cardTypes: {
    title: "Types de cartes",
    note: "En cas de conflit entre le texte d’une carte et ce guide, le texte de la carte prime. Chaque type ci-dessous montre une carte réelle du catalogue.",
    items: [
      {
        name: "Legend",
        body: "Personnages centraux du deck. Les 3 commencent face cachée. Call a Legend (1 €$, 1×/tour) en retourne une au hasard. Toute Legend peut aussi payer 1 €$.",
        exampleKey: "legendJackie",
      },
      {
        name: "Unit",
        body: "Membres du crew. Payez le coût et placez-la ready sur le Field. Une Unit ne peut pas attaquer le tour où elle est jouée (sauf Adrenaline).",
        exampleKey: "unitJackie",
      },
      {
        name: "Program",
        body: "Effet immédiat. Payez le coût, résolvez l’effet, puis placez la carte dans la Trash.",
        exampleKey: "programReaper",
      },
      {
        name: "Gear",
        body: "Équipement pour une Unit ou Legend alliée. Quand la carte équipée change de zone, le Gear la suit.",
        exampleKey: "gearConverter",
      },
    ],
  },
  triggers: {
    title: "Timing triggers",
    intro: "Les triggers indiquent quand un effet se déclenche.",
    items: [
      { name: "Play", body: "Quand vous jouez cette carte." },
      { name: "Call", body: "Quand vous retournez cette Legend via Call a Legend." },
      { name: "Attack", body: "Quand cette Unit attaque (avant la réaction du Rival).", exampleKey: "unitJackie" },
      { name: "Defeated", body: "Quand cette Unit est vaincue." },
    ],
  },
  keywords: {
    title: "Mots-clés",
    intro: "Effets standards partagés par plusieurs cartes — avec un exemple du catalogue.",
    items: [
      { name: "Adrenaline", body: "Cette Unit peut attaquer le tour où elle est jouée.", exampleKey: "unitAdrenaline" },
      {
        name: "Go Solo",
        body: "Payez le coût de cette Legend pour la jouer comme Unit ready. Elle peut attaquer ce tour. Si elle quitte le Field, retirez-la de la partie.",
        exampleKey: "legendJackie",
      },
      {
        name: "Quick",
        body: "Vous pouvez aussi activer cet effet (ou jouer ce Program) en réaction quand une Unit adverse attaque.",
        exampleKey: "programDetonate",
      },
      {
        name: "Blocker",
        body: "Quand une Unit adverse attaque, vous pouvez spender cette Unit pour rediriger l’attaque vers elle.",
        exampleKey: "unitBlocker",
      },
    ],
  },
  setup: {
    title: "Mise en place",
    intro: "Chaque joueur suit ces étapes avant la partie.",
    steps: [
      {
        title: "1. Mélanger",
        body: "Mélangez votre deck et placez vos 3 Legends face cachée, dans un ordre aléatoire, dans la zone Legends.",
      },
      {
        title: "2. Ordre de jeu",
        body: "Les deux joueurs lancent un d20 (relance en cas d’égalité). Le plus haut décide qui commence. Le premier joueur spend ses 2 Legends les plus à gauche et ne les ready pas à son premier tour.",
      },
      {
        title: "3. Piocher 6",
        body: "Vous pouvez mulligan une seule fois : mélangez la main dans le deck et piochez 6 nouvelles cartes.",
      },
    ],
  },
  turn: {
    title: "Structure du tour",
    intro: "Chaque tour a deux phases : Start Phase puis Main Phase.",
    startTitle: "Start Phase (dans l’ordre)",
    startSteps: [
      {
        title: "Ready",
        body: "Remettez toutes vos cartes spent (à l’horizontale) en position ready (verticale).",
      },
      {
        title: "Piocher 1",
        body: "Ajoutez la carte du dessus de votre deck à votre main.",
      },
      {
        title: "Gagner un Gig",
        body: "Prenez un dé de la zone Fixer, lancez-le et placez-le dans votre zone Gig. N’importe lequel sauf le d20, toujours en dernier.",
      },
    ],
    mainTitle: "Main Phase (dans n’importe quel ordre)",
    mainIntro: "Vous pouvez faire chacune de ces actions autant de fois que les règles le permettent.",
    mainActions: [
      {
        title: "Vendre pour 1 Eddie (1×/tour)",
        body: "Vendez une carte de votre main qui a le sell tag. Révélez-la, puis placez-la face cachée dans la zone Eddies. Quelle que soit son coût, elle ne vaut que 1 €$.",
      },
      {
        title: "Jouer une carte",
        body: "Dépensez des Eddies (et/ou des Legends à 1 €$ chacune) égaux au coût. Les Units arrivent avec Lag jusqu’à la fin du tour : elles ne peuvent ni attaquer ni activer d’effets self-spend.",
      },
      {
        title: "Call a Legend (1×/tour)",
        body: "Spendez 1 €$ pour retourner une Legend face visible, sans regarder avant.",
      },
      {
        title: "Attaquer",
        body: "Spendez l’Unit attaquante. Elle peut attaquer une Unit adverse spent, ou la zone Gig adverse pour voler un Gig.",
      },
    ],
  },
  attack: {
    title: "Attaque",
    intro:
      "Chaque Unit attaque individuellement et termine toute la séquence avant qu’une autre n’attaque. Cible : Unit adverse spent, ou zone Gig du Rival.",
    steps: [
      {
        title: "1. Spender l’attaquant",
        body: "Tournez l’Unit à l’horizontale et résolvez ses effets {Attack}. Une Unit ne peut pas attaquer le tour où elle est jouée (sauf Adrenaline).",
      },
      {
        title: "2. Déclarer la cible",
        body: "Unit adverse spent → combat. Zone Gig adverse → vol de Gig.",
      },
    ],
    reactTitle: "3. Réactions du Rival",
    reactIntro: "Le Rival attaqué peut faire n’importe lequel de ces choix, dans n’importe quel ordre.",
    reactions: [
      {
        title: "Call a Legend (1×/tour)",
        body: "Spendez 1 €$ pour retourner une Legend.",
      },
      {
        title: "Quick",
        body: "Activez des effets ou jouez des cartes avec Quick.",
      },
      {
        title: "Blocker",
        body: "Spendez une Unit Blocker pour rediriger l’attaque vers elle.",
      },
    ],
    fightTitle: "Combat (cible = Unit spent)",
    fightBody: [
      "Comparez la Power des deux Units.",
      "La plus haute vainc l’autre. En cas d’égalité, les deux sont vaincues.",
      "Placez les Units vaincues dans la Trash et résolvez leurs effets {Defeated}.",
    ],
    stealTitle: "Vol de Gig (cible = zone Gig)",
    stealBody:
      "Choisissez un dé Gig adverse et déplacez-le vers votre zone Gig. L’Unit vole un Gig supplémentaire tous les 10 de Power (0 Gig à Power 0).",
    stealTiers: ["Power 1+ → 1 Gig", "Power 10+ → 2 Gigs", "Power 20+ → 3 Gigs, etc."],
    tip: "Les Units ready ne peuvent pas être attaquées. Seules Quick / Blocker (et effets similaires) peuvent interrompre une attaque : ce sont souvent les seules Units utiles à garder ready. Si un Blocker redirige une attaque directe sur votre Rival, un combat a lieu contre le Blocker — même en le vainquant, vous ne volez aucun Gig.",
  },
  deckbuilding: {
    title: "Construction de deck & RAM",
    intro: "Pour construire un deck légal :",
    rules: [
      "Exactement 3 Legends aux noms uniques.",
      "Entre 40 et 50 cartes (hors Legends).",
      "Maximum 3 exemplaires d’une même carte.",
      "Respecter la limite de RAM fixée par vos Legends.",
    ],
    ramTitle: "RAM",
    ramBody: [
      "Chaque Legend a une couleur et une valeur RAM. La RAM cumulée de vos 3 Legends fixe le plafond par couleur pour le reste du deck : chaque carte d’une couleur doit avoir une RAM ≤ total de cette couleur.",
      "Exemple : Goro Takemura (2 Green) + Saburo Arasaka (2 Green) + Yorinobu Arasaka (2 Red) → cartes Green jusqu’à 4 RAM, cartes Red jusqu’à 2 RAM.",
    ],
  },
  glossary: {
    title: "Glossaire",
    items: [
      {
        term: "Spend / Spent",
        definition:
          "Tourner une carte à l’horizontale. Une carte spent ne peut plus être spendée avant d’être ready. Eddies et Legends spendent pour payer ; les Units spendent pour attaquer.",
      },
      {
        term: "Ready",
        definition:
          "Carte verticale. Seules les Units ready peuvent attaquer ; une Unit ready ne peut pas être attaquée.",
      },
      {
        term: "Eddies (€$)",
        definition:
          "Eurodollars. Chaque carte face cachée dans la zone Eddies vaut 1 Eddie. Les Legends peuvent payer 1 €$ mais ne sont pas des Eddies.",
      },
      {
        term: "Cost",
        definition: "Chiffre en haut à gauche. Spendez autant d’€$ pour jouer la carte.",
      },
      {
        term: "Sell",
        definition:
          "1×/tour : révéler une carte avec sell tag, la placer face cachée comme 1 Eddie.",
      },
      {
        term: "Gigs",
        definition:
          "Dés de jobs. Premier joueur à commencer son tour avec 7+ Gigs gagne. Volables en attaquant la zone Gig adverse.",
      },
      {
        term: "Street Cred",
        definition: "Somme des faces de vos dés Gig. Certains effets en exigent un seuil.",
      },
      {
        term: "Fixer",
        definition:
          "Zone des offres de jobs. Au début du tour, prenez un dé (d20 en dernier), lancez-le, placez-le en zone Gig.",
      },
      {
        term: "Lag",
        definition:
          "Les Units entrent avec Lag jusqu’à la fin du tour : pas d’attaque ni d’effet self-spend.",
      },
      {
        term: "Power",
        definition:
          "Chiffre en bas à droite. Sert au combat et au vol de Gigs (+1 Gig tous les 10 Power).",
      },
      {
        term: "Call a Legend",
        definition:
          "1×/tour, spend 1 €$ pour retourner une Legend. Possible en Main Phase ou en réaction à une attaque.",
      },
      {
        term: "Bottom-deck",
        definition: "Mettre des cartes sous le deck, dans n’importe quel ordre.",
      },
      {
        term: "Trash",
        definition:
          "Mettre la (ou les) carte(s) du dessus du deck dans la Trash, ou la zone où vont les cartes vaincues.",
      },
    ],
  },
};

const en: HowToPlayContent = {
  eyebrow: "RULES",
  title: "How to play",
  intro: [
    "In the Cyberpunk Trading Card Game, you’re the leader of your crew, competing against your Rival to become a Night City Legend. Take on Gigs, equip Units, deploy Programs, and boost your Street Cred.",
    "You need a set of six dice (d4, d6, d8, d10, d12, d20) and a Cyberpunk TCG deck. Win by controlling the majority of Gig dice and securing them until the start of your turn.",
  ],
  sourceLabel: "Official guide",
  sourceUrl: "https://cyberpunktcg.com/gameplay-guide",
  sourcePdfLabel: "Printable PDF",
  sourcePdfUrl: "https://cyberpunktcg.com/docs/printable-gameplay-guide.pdf",
  toc: [
    { id: "victoire", label: "Win condition" },
    { id: "zones", label: "Playmat" },
    { id: "anatomie", label: "Reading your cards" },
    { id: "cartes", label: "Card types" },
    { id: "mots-cles", label: "Triggers & keywords" },
    { id: "mise-en-place", label: "Setup" },
    { id: "tour", label: "Turn structure" },
    { id: "attaque", label: "Attacking" },
    { id: "deck", label: "Deck building" },
    { id: "glossaire", label: "Glossary" },
  ],
  win: {
    title: "Win condition",
    body: "Control the majority of Night City’s Gigs, represented by Gig dice. Protect yours and attack your Rival to steal theirs. Each die is one Gig — two dice always get you closer to winning than one, regardless of face values.",
    highlight: "Start your turn with 7 Gigs to win",
    highlightBody:
      "If a player has at least 7 Gig dice in their Gig area at the start of their turn, they win.",
    overtime: "Overtime: 7 Gigs wins instantly",
    overtimeBody:
      "Overtime begins after the last player’s 7th turn. Sudden death: as soon as a player has a majority of Gig dice, they win.",
    deckOut: "Deck out: if you must draw and your deck is empty, your Rival wins immediately.",
  },
  areas: {
    title: "Playmat areas",
    items: [
      {
        id: "fixer",
        name: "Fixer",
        body: "All Gig dice start here. After drawing at the start of your turn, choose a die (except the d20, always last), roll it, and move it to your Gig area.",
        tips: [
          "The dice are job offers your fixer has lined up for you.",
          "Small die = low but safe value; big die = more potential Street Cred.",
          "The d20 can only be picked once every other die is gone.",
        ],
      },
      {
        id: "rivalGig",
        name: "Rival Gigs",
        body: "The Gig dice your Rival controls. This is what your Units target when they attack directly: each successful attack takes a die from here and moves it to your Friendly Gigs area.",
        tips: [
          "A Unit steals 1 Gig, +1 per 10 Power (Power 10+ → 2 Gigs).",
          "If a Blocker redirects the attack, no Gig is stolen even if you win the fight.",
          "Watch their count: with 7 dice at the start of their turn, your Rival wins.",
        ],
      },
      {
        id: "gig",
        name: "Friendly Gigs",
        body: "Gigs you control, including stolen ones. Starting your turn with 7 dice here (before taking one from the Fixer) wins. Street Cred is the sum of the top faces.",
        tips: [
          "Each die = 1 Gig regardless of its value — the number of dice is what wins.",
          "Rival Units attack this area to steal your dice.",
          "Some cards require a ☆ Street Cred threshold to activate.",
        ],
      },
      {
        id: "field",
        name: "Field",
        body: "Where Units live. They can attack a spent rival Unit to fight, or the rival Gig area to steal a Gig. Gear equips onto Units here.",
        tips: [
          "Units enter ready but with Lag: no attacking the turn they’re played (unless Adrenaline).",
          "Attacking spends the Unit (sideways), which makes it attackable by your Rival.",
          "Ready Units can’t be attacked; only Quick / Blocker can interrupt an attack.",
        ],
      },
      {
        id: "eddies",
        name: "Eddies (€$)",
        body: "Night City currency. Pay a card’s top-left cost by spending that many Eddies. Starts empty — sell cards from hand to create Eddies.",
        tips: [
          "Sell: once per turn, a card with a sell tag (€$) → 1 face-down Eddie.",
          "Paying = spending (turning) Eddies; they ready at the start of your turn.",
          "A sold card is always worth 1 €$, even if it cost 8.",
        ],
      },
      {
        id: "legends",
        name: "Legends",
        body: "Your 3 Legends start face-down in random order. Once per turn, Call a Legend by spending 1 €$ to flip one without looking. Face-up or face-down, a Legend can also pay 1 €$.",
        tips: [
          "Call a Legend can also be done as a reaction to a rival attack.",
          "The first player starts with their 2 leftmost Legends spent.",
          "Legends with Go Solo can enter the Field as a Unit.",
        ],
      },
      {
        id: "deck",
        name: "Deck",
        body: "Draw from the top of your deck.",
        tips: ["40–50 cards, not counting Legends.", "Deck out: if you must draw from an empty deck, your Rival wins."],
      },
      {
        id: "trash",
        name: "Trash",
        body: "Discarded, defeated, or trashed cards go here face-up.",
        tips: ["Programs go here as soon as their effect resolves.", "A defeated Unit goes here with all its equipped Gear."],
      },
    ],
  },
  playmat: {
    hint: "Interactive mid-game playmat with real Welcome to Night City cards. Hover or click a zone to read what it does.",
    prev: "Previous",
    next: "Next",
    fixer: "Fixer",
    rivalGig: "Rival Gigs",
    gig: "Friendly Gigs",
    streetCred: "Street Cred = 4+6+10 = 20",
    legends: "Legends",
    field: "Field",
    eddies: "Eddies",
    deck: "Deck",
    trash: "Trash",
  },
  examplesTitle: "Real example",
  fightExample: {
    title: "Fight example",
    body: "Jackie (Unit) attacks Meredith (spent rival Unit). Compare Power: higher wins, tie = both to Trash.",
    attackerLabel: "Attacker",
    defenderLabel: "Defender (spent)",
    outcome: "If Jackie has higher Power, Meredith goes to Trash with any equipped Gear.",
  },
  stealExample: {
    title: "Gig steal example",
    body: "Adam Smasher: Metal Over Meat has Power 15. If he attacks the rival Gig area unblocked, he steals 2 Gigs (10+ threshold).",
  },
  cardTypes: {
    title: "Card types",
    note: "If a card’s text conflicts with this guide, follow the card. Each type below shows a real catalog card.",
    items: [
      {
        name: "Legend",
        body: "Centerpiece characters. All 3 begin face-down. Call a Legend (1 €$, once per turn) flips one at random. Any Legend can also pay 1 €$.",
        exampleKey: "legendJackie",
      },
      {
        name: "Unit",
        body: "Crew members. Pay the cost and place it ready on the Field. Units can’t attack the turn they’re played (unless Adrenaline).",
        exampleKey: "unitJackie",
      },
      {
        name: "Program",
        body: "Instant effect. Pay the cost, resolve it, then move the card to the Trash.",
        exampleKey: "programReaper",
      },
      {
        name: "Gear",
        body: "Equips a friendly Unit or Legend. When the host leaves its area, Gear goes with it.",
        exampleKey: "gearConverter",
      },
    ],
  },
  triggers: {
    title: "Timing triggers",
    intro: "Triggers tell you when an effect happens.",
    items: [
      { name: "Play", body: "When you play this card." },
      { name: "Call", body: "When you flip this Legend via Call a Legend." },
      { name: "Attack", body: "When this Unit attacks (before your Rival reacts).", exampleKey: "unitJackie" },
      { name: "Defeated", body: "When this Unit is defeated." },
    ],
  },
  keywords: {
    title: "Keywords",
    intro: "Standard effects shared across cards — with a catalog example.",
    items: [
      { name: "Adrenaline", body: "This Unit can attack the turn it’s played.", exampleKey: "unitAdrenaline" },
      {
        name: "Go Solo",
        body: "Pay this Legend’s cost to play it as a ready Unit. It can attack this turn. If it leaves the field, remove it from the game.",
        exampleKey: "legendJackie",
      },
      {
        name: "Quick",
        body: "You may also activate this effect (or play this Program) as a reaction when a rival Unit attacks.",
        exampleKey: "programDetonate",
      },
      {
        name: "Blocker",
        body: "When a rival Unit attacks, you may spend this Unit to redirect the attack to it instead.",
        exampleKey: "unitBlocker",
      },
    ],
  },
  setup: {
    title: "Setup",
    intro: "Each player follows these steps before the game.",
    steps: [
      {
        title: "1. Shuffle",
        body: "Shuffle your deck and randomize your Legends face-down in the Legends area.",
      },
      {
        title: "2. Play order",
        body: "Both players roll a d20 (reroll ties). Higher roll decides who goes first. The first player spends their 2 leftmost Legends and doesn’t ready them on their first turn.",
      },
      {
        title: "3. Draw 6",
        body: "You may mulligan once: shuffle your hand into the deck and draw 6 new cards.",
      },
    ],
  },
  turn: {
    title: "Turn structure",
    intro: "Each turn has two phases: Start Phase, then Main Phase.",
    startTitle: "Start Phase (in order)",
    startSteps: [
      {
        title: "Ready",
        body: "Return all spent (sideways) cards to the ready (upright) position.",
      },
      {
        title: "Draw 1",
        body: "Add the top card of your deck to your hand.",
      },
      {
        title: "Gain a Gig",
        body: "Take a die from your Fixer area, roll it, and add it to your Gig area. Any die except the d20, which is always last.",
      },
    ],
    mainTitle: "Main Phase (any order)",
    mainIntro: "Do any number of these actions as the rules allow.",
    mainActions: [
      {
        title: "Sell for Eddie (once per turn)",
        body: "Sell a hand card with a sell tag. Reveal it, then place it face-down in the Eddies area. It is always worth 1 €$ as an Eddie.",
      },
      {
        title: "Play a card",
        body: "Spend Eddies (and/or Legends as 1 €$ each) equal to the cost. Units enter with Lag until end of turn: they can’t attack or activate self-spend effects.",
      },
      {
        title: "Call a Legend (once per turn)",
        body: "Spend 1 €$ to flip a Legend face-up without peeking.",
      },
      {
        title: "Attack",
        body: "Spend the attacking Unit. Attack a spent rival Unit, or the rival Gig area to steal a Gig.",
      },
    ],
  },
  attack: {
    title: "Attacking",
    intro:
      "Each Unit attacks individually and finishes the full sequence before another can attack. Target a spent rival Unit or your Rival’s Gig area.",
    steps: [
      {
        title: "1. Spend the attacker",
        body: "Turn the Unit sideways and resolve {Attack} effects. Units can’t attack the turn they’re played (unless Adrenaline).",
      },
      {
        title: "2. Declare a target",
        body: "Spent rival Unit → fight. Rival Gig area → steal.",
      },
    ],
    reactTitle: "3. Rival reacts",
    reactIntro: "The attacked Rival may take any number of these reactions.",
    reactions: [
      {
        title: "Call a Legend (once per turn)",
        body: "Spend 1 €$ to flip a Legend face-up.",
      },
      {
        title: "Quick",
        body: "Activate effects or play cards with Quick.",
      },
      {
        title: "Blocker",
        body: "Spend a Blocker Unit to redirect the attack to it.",
      },
    ],
    fightTitle: "Fight (target = spent Unit)",
    fightBody: [
      "Compare both Units’ Power.",
      "Higher Power defeats the other. On a tie, both are defeated.",
      "Move defeated Units to the Trash and resolve {Defeated} effects.",
    ],
    stealTitle: "Steal (target = Gig area)",
    stealBody:
      "Choose a rival Gig die and move it to your Gig area. Steal an extra Gig for every 10 Power (0 Gigs at Power 0).",
    stealTiers: ["Power 1+ → 1 Gig", "Power 10+ → 2 Gigs", "Power 20+ → 3 Gigs, etc."],
    tip: "Ready Units can’t be attacked. Only Quick / Blocker (and similar) can interrupt attacks — those are usually the Units worth keeping ready. If a Blocker redirects a direct attack on your Rival, a fight happens against the Blocker instead — even if you defeat it, you steal no Gigs.",
  },
  deckbuilding: {
    title: "Deck building & RAM",
    intro: "Legal deck requirements:",
    rules: [
      "Exactly 3 Legend cards with unique names.",
      "40–50 cards (not counting Legends).",
      "No more than 3 copies of the same card.",
      "Stay within the RAM limit set by your Legends.",
    ],
    ramTitle: "RAM",
    ramBody: [
      "Each Legend has a color and RAM value. Their combined RAM per color caps which cards you can include: each card’s RAM must be ≤ your Legends’ total for that color.",
      "Example: Goro Takemura (2 Green) + Saburo Arasaka (2 Green) + Yorinobu Arasaka (2 Red) → Green cards up to 4 RAM, Red cards up to 2 RAM.",
    ],
  },
  glossary: {
    title: "Glossary",
    items: [
      {
        term: "Spend / Spent",
        definition:
          "Turn a card sideways. Spent cards can’t be spent again until readied. Eddies and Legends spend to pay; Units spend to attack.",
      },
      {
        term: "Ready",
        definition: "Upright card. Only ready Units can attack; ready Units can’t be attacked.",
      },
      {
        term: "Eddies (€$)",
        definition:
          "Eurodollars. Each face-down card in the Eddies area is 1 Eddie. Legends can pay 1 €$ but aren’t Eddies.",
      },
      {
        term: "Cost",
        definition: "Number in the top left. Spend that many €$ to play the card.",
      },
      {
        term: "Sell",
        definition: "Once per turn: reveal a sell-tag card, place it face-down as 1 Eddie.",
      },
      {
        term: "Gigs",
        definition:
          "Job dice. First player to start their turn with 7+ Gigs wins. Steal by attacking the rival Gig area.",
      },
      {
        term: "Street Cred",
        definition: "Sum of your Gig dice faces. Some effects require a threshold.",
      },
      {
        term: "Fixer",
        definition:
          "Job-offer area. Each turn, take a die (d20 last), roll it, move it to the Gig area.",
      },
      {
        term: "Lag",
        definition:
          "Units enter with Lag until end of turn: no attacking or self-spend effects.",
      },
      {
        term: "Power",
        definition:
          "Bottom-right number. Used in fights and Gig steals (+1 Gig per 10 Power).",
      },
      {
        term: "Call a Legend",
        definition:
          "Once per turn, spend 1 €$ to flip a Legend. Allowed in Main Phase or as a reaction to an attack.",
      },
      {
        term: "Bottom-deck",
        definition: "Put cards on the bottom of your deck in any order.",
      },
      {
        term: "Trash",
        definition: "Put the top card(s) of the deck into the Trash, or the zone for defeated cards.",
      },
    ],
  },
};

export function howtoPlayContent(locale: Locale | "fr" | "en"): HowToPlayContent {
  return locale === "fr" ? fr : en;
}
