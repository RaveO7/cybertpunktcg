import type { Locale } from "@/lib/i18n/messages";
import type { PlaymatZoneId } from "@/lib/rules/examples";
import { EXAMPLE_CARDS } from "@/lib/rules/examples";

export type TutorialLocale = "fr" | "en";

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

const fr: TutorialCopy = {
  eyebrow: "FORMATION NIGHT CITY",
  title: "Apprendre à jouer",
  subtitle: "6 mini-missions. Clique, essaie, gagne. Pas besoin d’avoir déjà joué à un TCG.",
  learnTab: "Parcours débutant",
  rulesTab: "Règles détaillées",
  startCta: "Commencer l’entraînement",
  continueCta: "Continuer",
  nextCta: "Mission suivante",
  backCta: "Retour",
  skipCta: "Passer",
  retryCta: "Réessayer",
  hintCta: "Indice",
  progressLabel: (current, total) => `Mission ${current} / ${total}`,
  streetCred: "Street Cred",
  correct: "Bien joué, choom.",
  almost: "Pas tout à fait — essaie encore.",
  missions: [
    { id: "intro", badge: "00", title: "Briefing", blurb: "Le but du jeu en 30 secondes." },
    { id: "goal", badge: "01", title: "Les Gigs", blurb: "Comment on gagne." },
    { id: "board", badge: "02", title: "Le tapis", blurb: "Où poser quoi." },
    { id: "cards", badge: "03", title: "Les cartes", blurb: "4 types, 4 jobs." },
    { id: "turn", badge: "04", title: "Ton tour", blurb: "Dans quel ordre jouer." },
    { id: "combat", badge: "05", title: "Combats", blurb: "Frapper ou voler." },
    { id: "quiz", badge: "06", title: "Examen rue", blurb: "Vérifie ce que tu retiens." },
    { id: "done", badge: "OK", title: "Diplôme", blurb: "Tu es prêt·e." },
  ],
  intro: {
    needTitle: "Ce qu’il te faut",
    needItems: [
      "Un deck Cyberpunk TCG (40–50 cartes + 3 Legends)",
      "6 dés : d4, d6, d8, d10, d12, d20",
      "Un Rival en face de toi",
    ],
    promise: "Tu es le chef d’un crew à Night City. Tu gagnes en contrôlant des jobs : les Gigs (des dés).",
    tip: "Astuce : un Gig = un dé. Ce n’est pas la valeur du dé qui compte pour gagner, c’est le nombre de dés.",
  },
  goal: {
    title: "Objectif : 7 Gigs",
    explain:
      "Chaque tour tu prends un dé dans ta zone Fixer, tu le lances, tu le mets dans ta zone Gig. Si tu commences ton tour avec déjà 7 dés Gig → tu gagnes.",
    challenge: "Simule une partie : ajoute des Gigs jusqu’à 7, puis « commence ton tour ».",
    winLine: "7 Gigs au début du tour = victoire. Night City est à toi.",
    addGig: "Prendre un Gig (début de tour)",
    stealGig: "Voler 1 Gig au Rival",
    fixerEmpty: "Fixer vide — vole le 7e au Rival",
    reset: "Recommencer",
    diceLeft: (n: number) => (n === 1 ? "1 dé encore au Fixer" : `${n} dés encore au Fixer`),
    yourGigs: "Tes Gigs",
  },
  board: {
    title: "Chasse aux zones",
    explain: "Le tapis a 7 zones. Clique sur la bonne zone pour chaque question.",
    challenge: "Trouve les 4 zones demandées. Tu peux te tromper, aucun Eddie n’est perdu.",
    prompts: [
      {
        ask: "Où places-tu tes Units pour combattre ?",
        zone: "field",
        hint: "C’est le grand espace au centre…",
        success: "Le Field : tes Units vivent ici.",
      },
      {
        ask: "Où vont les cartes vendues pour payer (Eddies) ?",
        zone: "eddies",
        hint: "C’est ta « banque » face cachée.",
        success: "Zone Eddies : chaque carte face cachée = 1 €$.",
      },
      {
        ask: "Où sont tes 3 personnages spéciaux au début ?",
        zone: "legends",
        hint: "Ils commencent face cachée…",
        success: "Zone Legends : 3 cartes, ordre aléatoire.",
      },
      {
        ask: "Où arrivent les dés après les avoir lancés ?",
        zone: "gig",
        hint: "C’est ce qui te fait gagner.",
        success: "Zone Gig : protège-les, ou vole ceux du Rival.",
      },
    ],
    foundAll: "Tapis validé. Tu sais où poser ton crew.",
  },
  cards: {
    title: "4 types de cartes",
    explain: "Retourne chaque carte pour découvrir son job. Une seule idée par type.",
    challenge: "Découvre les 4 types.",
    flipHint: "Touche la carte",
    roles: [
      {
        key: "legendJackie",
        typeLabel: "Legend",
        oneLiner: "Boss du deck",
        detail: "3 au total, face cachée. Tu peux en retourner 1 par tour (1 €$) ou les utiliser comme 1 €$ chacune.",
      },
      {
        key: "unitJackie",
        typeLabel: "Unit",
        oneLiner: "Ton crew",
        detail: "Reste sur le Field. Attaque les Units adverses ou vole des Gigs. Pas d’attaque le tour où elle arrive (sauf Adrenaline).",
      },
      {
        key: "programReaper",
        typeLabel: "Program",
        oneLiner: "Effet flash",
        detail: "Tu paies, l’effet se résout, la carte va à la Trash. Certains sont Quick (jouables en réaction).",
      },
      {
        key: "gearConverter",
        typeLabel: "Gear",
        oneLiner: "Équipement",
        detail: "S’attache à une Unit ou Legend. Si la carte part, le Gear part avec.",
      },
    ],
    allSeen: "Tu connais les 4 rôles. On enchaîne sur le rythme d’un tour.",
  },
  turn: {
    title: "Déroule un tour",
    explain: "Chaque tour = Start Phase (obligatoire, dans l’ordre) puis Main Phase (tu choisis).",
    challenge: "Enchaîne les étapes en cliquant « Faire cette action ».",
    steps: [
      {
        id: "ready",
        title: "1. Ready",
        body: "Remets tes cartes tournées à l’endroit.",
        action: "Ready mes cartes",
      },
      {
        id: "draw",
        title: "2. Piocher",
        body: "Prends 1 carte du dessus du deck.",
        action: "Piocher 1",
      },
      {
        id: "gig",
        title: "3. Gagner un Gig",
        body: "Prends un dé du Fixer (pas le d20 tant qu’il en reste), lance-le, mets-le en zone Gig.",
        action: "Lancer mon Gig",
      },
      {
        id: "sell",
        title: "4. Vendre (optionnel, 1×)",
        body: "Révèle une carte « vendable », pose-la face cachée = +1 Eddie.",
        action: "Vendre pour 1 €$",
      },
      {
        id: "play",
        title: "5. Jouer des cartes",
        body: "Dépense des Eddies (ou Legends) pour jouer Units, Gear, Programs.",
        action: "Jouer Jackie (exemple)",
      },
      {
        id: "attack",
        title: "6. Attaquer",
        body: "Tourne une Unit pour attaquer une Unit adverse spent, ou la zone Gig adverse.",
        action: "Attaquer",
      },
    ],
    done: "Tour terminé. Tu as le rythme : Ready → Piocher → Gig → puis ce que tu veux.",
  },
  combat: {
    title: "Frapper ou voler ?",
    explain: "Deux cibles possibles. Choisis la bonne action pour chaque situation.",
    scenarios: [
      {
        id: "steal",
        setup: "Adam Smasher (Power 15) est ready. Le Rival a des Gigs et aucune Unit spent.",
        question: "Que faire pour avancer vers la victoire ?",
        choices: [
          {
            id: "a",
            label: "Attaquer la zone Gig → voler 2 Gigs",
            correct: true,
            feedback: "Power 15 = 2 Gigs (1 dès 1+, +1 dès 10+).",
          },
          {
            id: "b",
            label: "Attaquer une Unit ready adverse",
            correct: false,
            feedback: "Tu ne peux pas attaquer une Unit ready (sauf effet spécial).",
          },
          {
            id: "c",
            label: "Ne rien faire : trop risqué",
            correct: false,
            feedback: "Possible, mais ici le vol de Gig est l’objectif principal.",
          },
        ],
      },
      {
        id: "fight",
        setup: "Jackie (forte) face à Meredith adverse qui est spent (tournée).",
        question: "Comment dégager le Field ?",
        choices: [
          {
            id: "a",
            label: "Attaquer Meredith → combat Power vs Power",
            correct: true,
            feedback: "Le plus haut Power vainc. Égalité = les deux partent à la Trash.",
          },
          {
            id: "b",
            label: "Attaquer directement les Gigs sans regarder",
            correct: false,
            feedback: "Tu peux, mais une Unit spent dangereuse mérite souvent d’être enlevée d’abord.",
          },
          {
            id: "c",
            label: "Jouer un Gear sur le Rival",
            correct: false,
            feedback: "Le Gear s’équipe sur TES Units / Legends, pas sur le Rival.",
          },
        ],
      },
      {
        id: "block",
        setup: "Le Rival attaque ta zone Gig. Tu as Meredith avec Blocker, ready.",
        question: "Peux-tu réagir ?",
        choices: [
          {
            id: "a",
            label: "Spend Meredith (Blocker) pour prendre le coup",
            correct: true,
            feedback: "Blocker redirige l’attaque. Même si tu gagnes le combat, l’attaquant ne vole pas de Gig.",
          },
          {
            id: "b",
            label: "Impossible, les Gigs sont sans défense",
            correct: false,
            feedback: "Blocker (et Quick) existent justement pour ça.",
          },
          {
            id: "c",
            label: "Piocher 3 cartes en réaction",
            correct: false,
            feedback: "Pas une règle de base — sauf si une carte le dit.",
          },
        ],
      },
    ],
    allClear: "Tu gères combat et vol. Dernière étape : le quiz.",
  },
  quiz: {
    title: "Examen de rue",
    explain: "5 questions. 4 bonnes réponses = diplôme Night City.",
    questions: [
      {
        id: "q1",
        prompt: "Quand gagnes-tu la partie ?",
        choices: [
          {
            id: "a",
            label: "Dès que tu as 7 Gigs, même au milieu du tour du Rival",
            correct: false,
            feedback: "Il faut commencer TON tour avec 7 Gigs (sauf prolongations).",
          },
          {
            id: "b",
            label: "Au début de ton tour, si tu as déjà 7 Gigs",
            correct: true,
            feedback: "Exact.",
          },
          {
            id: "c",
            label: "Quand la somme des dés atteint 50",
            correct: false,
            feedback: "La somme = Street Cred (pouvoirs), pas la victoire.",
          },
        ],
      },
      {
        id: "q2",
        prompt: "À quoi sert un Eddie ?",
        choices: [
          {
            id: "a",
            label: "Payer le coût des cartes",
            correct: true,
            feedback: "1 carte face cachée dans la zone Eddies = 1 €$.",
          },
          {
            id: "b",
            label: "Attaquer le Rival",
            correct: false,
            feedback: "Ce sont les Units qui attaquent.",
          },
          {
            id: "c",
            label: "Remplacer les dés Gig",
            correct: false,
            feedback: "Les Gigs restent des dés.",
          },
        ],
      },
      {
        id: "q3",
        prompt: "Une Unit vient d’être jouée. Peut-elle attaquer ?",
        choices: [
          {
            id: "a",
            label: "Oui, toujours",
            correct: false,
            feedback: "Elle a du Lag jusqu’à la fin du tour.",
          },
          {
            id: "b",
            label: "Non, sauf si elle a Adrenaline (ou effet similaire)",
            correct: true,
            feedback: "Lag = pas d’attaque le tour d’arrivée.",
          },
          {
            id: "c",
            label: "Seulement si c’est une Legend",
            correct: false,
            feedback: "Les Legends Go Solo sont un autre cas.",
          },
        ],
      },
      {
        id: "q4",
        prompt: "Ordre de la Start Phase ?",
        choices: [
          {
            id: "a",
            label: "Piocher → Ready → Gig",
            correct: false,
            feedback: "Presque : Ready d’abord.",
          },
          {
            id: "b",
            label: "Ready → Piocher → Gig",
            correct: true,
            feedback: "Dans cet ordre, toujours.",
          },
          {
            id: "c",
            label: "Gig → Piocher → Attaquer",
            correct: false,
            feedback: "L’attaque est en Main Phase.",
          },
        ],
      },
      {
        id: "q5",
        prompt: "Power 20 en attaque sur la zone Gig : combien de Gigs volés ?",
        choices: [
          { id: "a", label: "1", correct: false, feedback: "1 dès Power 1+, +1 tous les 10." },
          { id: "b", label: "2", correct: false, feedback: "20+ = 3 Gigs." },
          { id: "c", label: "3", correct: true, feedback: "1+ → 1, 10+ → 2, 20+ → 3." },
        ],
      },
    ],
    scoreLine: (score, total) => `${score} / ${total} bonnes réponses`,
    pass: "Diplôme validé. Tu peux lire les règles détaillées quand tu veux.",
    retry: "Encore un effort — refais le quiz.",
  },
  done: {
    title: "Bienvenue à Night City",
    body: "Tu as les bases : Gigs, zones, types de cartes, tour, combat. Le reste s’apprend en jouant — et dans les règles détaillées.",
    restart: "Refaire le parcours",
    openRules: "Voir les règles détaillées",
    source: "Guide officiel Cyberpunk TCG",
  },
};

const en: TutorialCopy = {
  eyebrow: "NIGHT CITY TRAINING",
  title: "Learn to play",
  subtitle: "6 short missions. Click, try, win. No TCG experience needed.",
  learnTab: "Beginner path",
  rulesTab: "Full rules",
  startCta: "Start training",
  continueCta: "Continue",
  nextCta: "Next mission",
  backCta: "Back",
  skipCta: "Skip",
  retryCta: "Try again",
  hintCta: "Hint",
  progressLabel: (current, total) => `Mission ${current} / ${total}`,
  streetCred: "Street Cred",
  correct: "Nice work, choom.",
  almost: "Not quite — try again.",
  missions: [
    { id: "intro", badge: "00", title: "Briefing", blurb: "The goal in 30 seconds." },
    { id: "goal", badge: "01", title: "Gigs", blurb: "How you win." },
    { id: "board", badge: "02", title: "Playmat", blurb: "Where things go." },
    { id: "cards", badge: "03", title: "Cards", blurb: "4 types, 4 jobs." },
    { id: "turn", badge: "04", title: "Your turn", blurb: "What order to act." },
    { id: "combat", badge: "05", title: "Combat", blurb: "Fight or steal." },
    { id: "quiz", badge: "06", title: "Street exam", blurb: "Check what stuck." },
    { id: "done", badge: "OK", title: "Diploma", blurb: "You’re ready." },
  ],
  intro: {
    needTitle: "What you need",
    needItems: [
      "A Cyberpunk TCG deck (40–50 cards + 3 Legends)",
      "6 dice: d4, d6, d8, d10, d12, d20",
      "A Rival across the table",
    ],
    promise: "You lead a Night City crew. You win by controlling jobs: Gigs (dice).",
    tip: "Tip: one Gig = one die. Face values matter for Street Cred, not for the win count.",
  },
  goal: {
    title: "Goal: 7 Gigs",
    explain:
      "Each turn take a die from your Fixer, roll it, put it in your Gig area. If you start your turn already holding 7 Gig dice → you win.",
    challenge: "Simulate a game: add Gigs up to 7, then “start your turn”.",
    winLine: "7 Gigs at the start of your turn = victory.",
    addGig: "Take a Gig (start of turn)",
    stealGig: "Steal 1 Gig from Rival",
    fixerEmpty: "Fixer empty — steal the 7th from Rival",
    reset: "Reset",
    diceLeft: (n: number) => (n === 1 ? "1 die left in Fixer" : `${n} dice left in Fixer`),
    yourGigs: "Your Gigs",
  },
  board: {
    title: "Zone hunt",
    explain: "The playmat has 7 zones. Click the right zone for each question.",
    challenge: "Find all 4 asked zones. Wrong clicks are free.",
    prompts: [
      {
        ask: "Where do Units go to fight?",
        zone: "field",
        hint: "The big center space…",
        success: "Field: your Units live here.",
      },
      {
        ask: "Where do sold cards go for payment (Eddies)?",
        zone: "eddies",
        hint: "Your face-down “bank”.",
        success: "Eddies area: each face-down card = 1 €$.",
      },
      {
        ask: "Where are your 3 special characters at the start?",
        zone: "legends",
        hint: "They begin face-down…",
        success: "Legends area: 3 cards, random order.",
      },
      {
        ask: "Where do dice go after you roll them?",
        zone: "gig",
        hint: "This is how you win.",
        success: "Gig area: protect yours, steal theirs.",
      },
    ],
    foundAll: "Playmat cleared. You know where the crew sits.",
  },
  cards: {
    title: "4 card types",
    explain: "Flip each card to learn its job. One idea per type.",
    challenge: "Discover all 4 types.",
    flipHint: "Tap the card",
    roles: [
      {
        key: "legendJackie",
        typeLabel: "Legend",
        oneLiner: "Deck bosses",
        detail: "Exactly 3, start face-down. Flip one per turn (1 €$) or spend any as 1 €$.",
      },
      {
        key: "unitJackie",
        typeLabel: "Unit",
        oneLiner: "Your crew",
        detail: "Stay on the Field. Attack spent Units or steal Gigs. Can’t attack the turn played (unless Adrenaline).",
      },
      {
        key: "programReaper",
        typeLabel: "Program",
        oneLiner: "Flash effect",
        detail: "Pay, resolve, Trash. Some are Quick (reaction timing).",
      },
      {
        key: "gearConverter",
        typeLabel: "Gear",
        oneLiner: "Equipment",
        detail: "Attaches to a Unit or Legend. Leaves with its host.",
      },
    ],
    allSeen: "You know the four roles. Next: turn rhythm.",
  },
  turn: {
    title: "Run a turn",
    explain: "Every turn = Start Phase (fixed order) then Main Phase (your choice).",
    challenge: "Click through each step with “Do this”.",
    steps: [
      {
        id: "ready",
        title: "1. Ready",
        body: "Stand spent cards upright again.",
        action: "Ready my cards",
      },
      {
        id: "draw",
        title: "2. Draw",
        body: "Take the top card of your deck.",
        action: "Draw 1",
      },
      {
        id: "gig",
        title: "3. Gain a Gig",
        body: "Take a Fixer die (d20 last), roll it, move it to Gig.",
        action: "Roll my Gig",
      },
      {
        id: "sell",
        title: "4. Sell (optional, once)",
        body: "Reveal a sellable card, set it face-down = +1 Eddie.",
        action: "Sell for 1 €$",
      },
      {
        id: "play",
        title: "5. Play cards",
        body: "Spend Eddies (or Legends) to play Units, Gear, Programs.",
        action: "Play Jackie (example)",
      },
      {
        id: "attack",
        title: "6. Attack",
        body: "Spend a Unit to attack a spent rival Unit or the rival Gig area.",
        action: "Attack",
      },
    ],
    done: "Turn complete. Rhythm: Ready → Draw → Gig → then whatever you want.",
  },
  combat: {
    title: "Fight or steal?",
    explain: "Two possible targets. Pick the right move for each setup.",
    scenarios: [
      {
        id: "steal",
        setup: "Adam Smasher (Power 15) is ready. Rival has Gigs and no spent Units.",
        question: "Best way to push for the win?",
        choices: [
          {
            id: "a",
            label: "Attack the Gig area → steal 2 Gigs",
            correct: true,
            feedback: "Power 15 = 2 Gigs (1 at 1+, +1 at 10+).",
          },
          {
            id: "b",
            label: "Attack a ready rival Unit",
            correct: false,
            feedback: "You can’t attack ready Units (unless a card says so).",
          },
          {
            id: "c",
            label: "Do nothing — too risky",
            correct: false,
            feedback: "Allowed, but stealing Gigs is the main win path here.",
          },
        ],
      },
      {
        id: "fight",
        setup: "Jackie (strong) vs spent rival Meredith.",
        question: "How do you clear the Field?",
        choices: [
          {
            id: "a",
            label: "Attack Meredith → Power vs Power",
            correct: true,
            feedback: "Higher Power wins. Tie = both to Trash.",
          },
          {
            id: "b",
            label: "Always ignore Units and only steal",
            correct: false,
            feedback: "Sometimes true — but a dangerous spent Unit is often worth removing.",
          },
          {
            id: "c",
            label: "Equip Gear onto the Rival",
            correct: false,
            feedback: "Gear only equips to your Units / Legends.",
          },
        ],
      },
      {
        id: "block",
        setup: "Rival attacks your Gig area. You have ready Meredith with Blocker.",
        question: "Can you react?",
        choices: [
          {
            id: "a",
            label: "Spend Meredith (Blocker) to take the hit",
            correct: true,
            feedback: "Blocker redirects the attack. Even if you win the fight, no Gig is stolen.",
          },
          {
            id: "b",
            label: "No — Gigs can’t be protected",
            correct: false,
            feedback: "Blocker (and Quick) exist for this.",
          },
          {
            id: "c",
            label: "Draw 3 as a free reaction",
            correct: false,
            feedback: "Not a base rule — only if a card says so.",
          },
        ],
      },
    ],
    allClear: "Combat and steals: locked in. Last stop: the quiz.",
  },
  quiz: {
    title: "Street exam",
    explain: "5 questions. Score 4+ to graduate Night City.",
    questions: [
      {
        id: "q1",
        prompt: "When do you win?",
        choices: [
          {
            id: "a",
            label: "As soon as you hit 7 Gigs, even mid-rival turn",
            correct: false,
            feedback: "You must start YOUR turn with 7 (except overtime).",
          },
          {
            id: "b",
            label: "At the start of your turn if you already have 7 Gigs",
            correct: true,
            feedback: "Correct.",
          },
          {
            id: "c",
            label: "When dice faces sum to 50",
            correct: false,
            feedback: "That’s Street Cred, not the win condition.",
          },
        ],
      },
      {
        id: "q2",
        prompt: "What are Eddies for?",
        choices: [
          {
            id: "a",
            label: "Paying card costs",
            correct: true,
            feedback: "Each face-down Eddies card = 1 €$.",
          },
          {
            id: "b",
            label: "Attacking your Rival",
            correct: false,
            feedback: "Units attack.",
          },
          {
            id: "c",
            label: "Replacing Gig dice",
            correct: false,
            feedback: "Gigs stay dice.",
          },
        ],
      },
      {
        id: "q3",
        prompt: "A Unit was just played. Can it attack?",
        choices: [
          {
            id: "a",
            label: "Yes, always",
            correct: false,
            feedback: "It has Lag until end of turn.",
          },
          {
            id: "b",
            label: "No, unless it has Adrenaline (or similar)",
            correct: true,
            feedback: "Lag blocks attacking on arrival.",
          },
          {
            id: "c",
            label: "Only if it’s a Legend",
            correct: false,
            feedback: "Go Solo Legends are a separate case.",
          },
        ],
      },
      {
        id: "q4",
        prompt: "Start Phase order?",
        choices: [
          {
            id: "a",
            label: "Draw → Ready → Gig",
            correct: false,
            feedback: "Ready comes first.",
          },
          {
            id: "b",
            label: "Ready → Draw → Gig",
            correct: true,
            feedback: "Always that order.",
          },
          {
            id: "c",
            label: "Gig → Draw → Attack",
            correct: false,
            feedback: "Attack is Main Phase.",
          },
        ],
      },
      {
        id: "q5",
        prompt: "Power 20 attacking the Gig area steals how many Gigs?",
        choices: [
          { id: "a", label: "1", correct: false, feedback: "1 at Power 1+, +1 every 10." },
          { id: "b", label: "2", correct: false, feedback: "20+ = 3 Gigs." },
          { id: "c", label: "3", correct: true, feedback: "1+ → 1, 10+ → 2, 20+ → 3." },
        ],
      },
    ],
    scoreLine: (score, total) => `${score} / ${total} correct`,
    pass: "Diploma unlocked. Dive into full rules whenever you want.",
    retry: "Close — run the quiz again.",
  },
  done: {
    title: "Welcome to Night City",
    body: "You’ve got the basics: Gigs, zones, card types, turns, combat. The rest comes from playing — and the detailed rules.",
    restart: "Replay the path",
    openRules: "Open detailed rules",
    source: "Official Cyberpunk TCG guide",
  },
};

export function tutorialCopy(locale: Locale | TutorialLocale): TutorialCopy {
  return locale === "fr" ? fr : en;
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
