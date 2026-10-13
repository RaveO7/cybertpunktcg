/**
 * Textes des pages publiques rendues côté serveur (accueil, catalogue, fiches, métadonnées).
 * Ces pages n'existent qu'en français et en anglais (cf. src/lib/seo/routes.ts) ; les écrans de
 * l'application gardent leurs textes dans src/lib/i18n/messages.ts (5 langues).
 */

import type { SiteLocale } from "@/lib/seo/routes";

const COLOR_LABELS: Record<SiteLocale, Record<string, string>> = {
  fr: { Red: "Rouge", Blue: "Bleu", Green: "Vert", Yellow: "Jaune" },
  en: { Red: "Red", Blue: "Blue", Green: "Green", Yellow: "Yellow" },
};

const TYPE_LABELS: Record<SiteLocale, Record<string, string>> = {
  fr: {
    Legend: "Légende",
    Unit: "Unité",
    Program: "Programme",
    Gear: "Équipement",
  },
  en: { Legend: "Legend", Unit: "Unit", Program: "Program", Gear: "Gear" },
};

const TYPE_PLURALS: Record<SiteLocale, Record<string, string>> = {
  fr: {
    Legend: "Légendes",
    Unit: "Unités",
    Program: "Programmes",
    Gear: "Équipements",
  },
  en: { Legend: "Legends", Unit: "Units", Program: "Programs", Gear: "Gear" },
};

export function colorLabel(locale: SiteLocale, color: string | null) {
  return color ? (COLOR_LABELS[locale][color] ?? color) : null;
}

export function typeLabel(locale: SiteLocale, type: string | null) {
  return type ? (TYPE_LABELS[locale][type] ?? type) : null;
}

export function typePlural(locale: SiteLocale, type: string) {
  return TYPE_PLURALS[locale][type] ?? type;
}

const fr = {
  intl: "fr-FR",
  breadcrumb: { label: "Fil d'Ariane", home: "Accueil" },
  nav: {
    cards: "Cartes",
    tournaments: "Tournois",
    shops: "Boutiques",
    howToPlay: "Comment jouer",
  },
  landing: {
    eyebrow: "Cyberpunk TCG · outil de fans gratuit",
    title:
      "Toutes les cartes Cyberpunk TCG, votre collection et les tournois près de chez vous",
    lead: "TCG Tracker réunit le catalogue complet du jeu de cartes Cyberpunk TCG, le suivi de votre collection et de sa valeur, vos decks, et un annuaire des tournois et boutiques. Gratuit, sans publicité.",
    register: "Créer un compte gratuit",
    login: "Se connecter",
    openApp: "Ouvrir l'application",
    browseCards: "Parcourir les cartes",
    featuresTitle: "Ce que vous pouvez faire",
    features: [
      {
        key: "cards",
        title: "Catalogue complet",
        body: "Chaque carte avec son image, son coût, sa puissance, sa RAM, son texte de règles, ses impressions et son prix de marché.",
      },
      {
        key: "collection",
        title: "Suivi de collection",
        body: "Notez vos cartes, leur état et leur prix d'achat, et suivez la valeur de votre collection au fil des prix Cardmarket.",
      },
      {
        key: "decks",
        title: "Construction de decks",
        body: "Montez vos decks avec les règles de construction vérifiées et voyez ce qu'il vous manque.",
      },
      {
        key: "tournaments",
        title: "Tournois",
        body: "Trouvez un tournoi près de chez vous, inscrivez-vous en un clic, ou organisez le vôtre : appariements, chrono et classement.",
      },
      {
        key: "shops",
        title: "Boutiques",
        body: "Découvrez les boutiques qui font vivre le jeu, leurs horaires et leurs prochains événements.",
      },
      {
        key: "howToPlay",
        title: "Apprendre à jouer",
        body: "Un tutoriel pas à pas et les règles résumées pour faire votre première partie.",
      },
    ],
    cardsCount: (count: number) => `${count} cartes référencées`,
    upcomingTitle: "Prochains tournois",
    upcomingEmpty: "Aucun tournoi public annoncé pour l'instant.",
    upcomingAll: "Voir tous les tournois",
    finalTitle: "Prêt à suivre votre collection ?",
    finalBody:
      "Créez un compte gratuit et retrouvez vos cartes sur tous vos appareils, même hors ligne.",
  },
  catalog: {
    title: "Liste des cartes Cyberpunk TCG",
    metaTitle: "Liste des cartes Cyberpunk TCG",
    metaDescription: (count: number) =>
      `Les ${count} cartes du jeu Cyberpunk TCG : Légendes, Unités, Programmes et Équipements, avec texte, coût, puissance, RAM, impressions et prix.`,
    intro: (count: number) =>
      `${count} cartes de jeu, classées dans l'ordre de la liste officielle. Touchez une carte pour voir sa fiche.`,
    colorFilter: "Couleur",
    typeFilter: "Type",
    all: "Toutes",
    results: (count: number) => `${count} carte${count > 1 ? "s" : ""}`,
    empty: "Aucune carte ne correspond à ces filtres.",
    track: "Suivre ma collection",
    filters: "Filtres",
    reset: "Réinitialiser les filtres",
    costFilter: "Coût",
    search: "Rechercher",
    searchPlaceholder: "Rechercher une carte…",
  },
  card: {
    metaTitle: (name: string) => `${name} — carte Cyberpunk TCG`,
    metaDescription: (name: string, facts: string, rules: string | null) =>
      `${name} : ${facts}.${rules ? ` ${rules}` : ""}`,
    cost: "Coût",
    power: "Puissance",
    ram: "RAM",
    type: "Type",
    color: "Couleur",
    tags: "Affiliations",
    keywords: "Mots-clés",
    rules: "Texte de règles",
    flavor: "Texte d'ambiance",
    untranslated:
      "Pas encore d'impression française : nom et texte en anglais.",
    printings: "Impressions",
    set: "Extension",
    number: "N°",
    rarity: "Rareté",
    language: "Langue",
    artist: "Illustration",
    price: "Prix",
    marketPrice: "Prix de marché indicatif",
    priceAsOf: (date: string) => `Tendance Cardmarket au ${date}`,
    previous: "Carte précédente",
    next: "Carte suivante",
    // « Autres cartes bleues » : accord au féminin pluriel (Rouge → rouges, Bleu → bleues, Vert → vertes).
    sameColor: (color: string) =>
      `Autres cartes ${({ Rouge: "rouges", Bleu: "bleues", Vert: "vertes", Jaune: "jaunes" } as Record<string, string>)[color] ?? color.toLowerCase()}`,
    addToCollection: "Ajouter à ma collection",
    backToList: "Toutes les cartes",
    imageAlt: (name: string) => `Carte ${name}`,
  },
  howToPlay: {
    metaTitle: "Comment jouer à Cyberpunk TCG — règles et tutoriel",
    metaDescription:
      "Apprenez à jouer à Cyberpunk TCG : tutoriel pas à pas, déroulé d'un tour, Légendes, Unités, Programmes, Équipements et conditions de victoire.",
    teaser: {
      eyebrow: "Apprendre à jouer",
      title: "Devenez une légende de Night City",
      lead: "Cyberpunk TCG est un jeu de cartes à deux joueurs. Vous dirigez un crew de mercenaires face à un Rival, et chaque tour est une course pour rafler les meilleurs contrats de la ville. Des parties rapides et tendues, où une attaque bien placée peut tout renverser.",
      goalTitle: "L'objectif : 7 Gigs",
      goalBody:
        "Les contrats de Night City, les Gigs, sont représentés par des dés, du d4 au d20. Commencez votre tour avec 7 dés Gig dans votre zone et vous gagnez. Le piège : chaque joueur n'en a que six. Pour gagner, il faut forcément aller en voler à son Rival.",
      dice: ["d4", "d6", "d8", "d10", "d12", "d20"],
      diceNote: "Petit dé, gain sûr. Gros dé, plus de Street Cred… mais une cible plus tentante.",
      cardsTitle: "Quatre types de cartes",
      cards: [
        {
          type: "Legend",
          body: "Les figures de votre crew. Trois Légendes commencent face cachée : révélez-les au bon moment pour déclencher leurs pouvoirs, ou dépensez-les comme des Eddies.",
        },
        {
          type: "Unit",
          body: "Vos mercenaires sur le terrain. Ils attaquent les Unités adverses ou foncent directement sur les Gigs du Rival pour les lui prendre.",
        },
        {
          type: "Program",
          body: "Des hacks à effet immédiat : un coup de pouce décisif, une Unité adverse neutralisée, une attaque qui change tout.",
        },
        {
          type: "Gear",
          body: "Armes et implants à équiper sur une Unité ou une Légende pour la rendre plus redoutable.",
        },
      ],
      turnTitle: "Un tour en trois temps",
      turn: [
        { title: "Piocher", body: "Redressez vos cartes et piochez une carte." },
        { title: "Décrocher un Gig", body: "Choisissez un dé chez votre Fixer, lancez-le et ajoutez-le à vos Gigs." },
        {
          title: "Jouer et attaquer",
          body: "Payez vos cartes en Eddies, appelez vos Légendes, puis lancez vos Unités à l'assaut.",
        },
      ],
      fightTitle: "Attaquer, voler, survivre",
      fightBody: [
        "Une Unité qui attaque vole un dé Gig à votre Rival, et même plusieurs si sa Power est assez élevée.",
        "Mais attaquer l'expose : couchée, elle devient une cible pour le prochain tour adverse. Une Unité plus puissante l'emporte, et le Rival peut riposter avec des cartes Quick ou un Blocker.",
        "À vous de choisir quand frapper, et quand garder vos défenses debout.",
      ],
      deckTitle: "Votre deck, votre style",
      deckBody:
        "Trois Légendes et 40 à 50 cartes. Les couleurs de vos Légendes fixent la RAM disponible pour le reste du deck : chaque crew a sa propre identité.",
      ctaTitle: "Prêt à jouer pour de vrai ?",
      ctaBody:
        "Connectez-vous pour lancer le parcours interactif : une vraie partie guidée contre un Rival, coup par coup, avec les règles complètes à portée de main. C'est gratuit.",
      register: "Créer un compte gratuit",
      login: "Se connecter",
      browseCards: "Parcourir les cartes",
    },
  },
  tournaments: {
    metaTitle: "Tournois Cyberpunk TCG près de chez vous",
    metaDescription:
      "Trouvez un tournoi Cyberpunk TCG près de chez vous : boutiques, dates, formats, prix d'entrée et places restantes. Inscription en un clic.",
    crumb: "Tournois",
    itemTitle: (name: string) => `${name} — tournoi Cyberpunk TCG`,
    itemDescription: (parts: string[]) =>
      `Tournoi Cyberpunk TCG ${parts.join(" · ")}. Infos, places restantes et inscription.`,
  },
  shops: {
    metaTitle: "Boutiques Cyberpunk TCG",
    metaDescription:
      "Les boutiques de jeux qui organisent des tournois Cyberpunk TCG près de chez vous : adresses, horaires et prochains événements.",
    crumb: "Boutiques",
    itemTitle: (name: string, city: string) =>
      `${name}, boutique Cyberpunk TCG à ${city}`,
    itemDescription: (name: string, city: string) =>
      `${name}, boutique de jeux à ${city} : tournois Cyberpunk TCG à venir, résultats, adresse et horaires.`,
  },
  og: {
    tagline: "Cartes, collection et tournois Cyberpunk TCG",
    tournament: "Tournoi Cyberpunk TCG",
    shop: "Boutique Cyberpunk TCG",
    free: "Gratuit",
  },
};

export type SiteCopy = typeof fr;

const en: SiteCopy = {
  intl: "en-US",
  breadcrumb: { label: "Breadcrumb", home: "Home" },
  nav: {
    cards: "Cards",
    tournaments: "Tournaments",
    shops: "Shops",
    howToPlay: "How to play",
  },
  landing: {
    eyebrow: "Cyberpunk TCG · free fan-made tool",
    title: "Every Cyberpunk TCG card, your collection and tournaments near you",
    lead: "TCG Tracker brings together the full Cyberpunk TCG card list, collection and value tracking, deck building, and a directory of tournaments and game stores. Free, no ads.",
    register: "Create a free account",
    login: "Log in",
    openApp: "Open the app",
    browseCards: "Browse the cards",
    featuresTitle: "What you can do",
    features: [
      {
        key: "cards",
        title: "Full card list",
        body: "Every card with its image, cost, power, RAM, rules text, printings and market price.",
      },
      {
        key: "collection",
        title: "Collection tracking",
        body: "Log your cards, their condition and purchase price, and follow your collection's value with Cardmarket prices.",
      },
      {
        key: "decks",
        title: "Deck building",
        body: "Build decks with checked construction rules and see which cards you are missing.",
      },
      {
        key: "tournaments",
        title: "Tournaments",
        body: "Find a tournament near you, sign up in one click, or run your own: pairings, round clock and standings.",
      },
      {
        key: "shops",
        title: "Game stores",
        body: "Discover the stores that keep the game alive, their opening hours and upcoming events.",
      },
      {
        key: "howToPlay",
        title: "Learn to play",
        body: "A step-by-step tutorial and a rules summary to play your first game.",
      },
    ],
    cardsCount: (count: number) => `${count} cards listed`,
    upcomingTitle: "Upcoming tournaments",
    upcomingEmpty: "No public tournament announced yet.",
    upcomingAll: "See all tournaments",
    finalTitle: "Ready to track your collection?",
    finalBody:
      "Create a free account and find your cards on all your devices, even offline.",
  },
  catalog: {
    title: "Cyberpunk TCG card list",
    metaTitle: "Cyberpunk TCG card list",
    metaDescription: (count: number) =>
      `All ${count} Cyberpunk TCG cards: Legends, Units, Programs and Gear, with rules text, cost, power, RAM, printings and prices.`,
    intro: (count: number) =>
      `${count} game cards, in official checklist order. Tap a card to open its page.`,
    colorFilter: "Color",
    typeFilter: "Type",
    all: "All",
    results: (count: number) => `${count} card${count > 1 ? "s" : ""}`,
    empty: "No card matches these filters.",
    track: "Track my collection",
    filters: "Filters",
    reset: "Reset filters",
    costFilter: "Cost",
    search: "Search",
    searchPlaceholder: "Search a card…",
  },
  card: {
    metaTitle: (name: string) => `${name} — Cyberpunk TCG card`,
    metaDescription: (name: string, facts: string, rules: string | null) =>
      `${name}: ${facts}.${rules ? ` ${rules}` : ""}`,
    cost: "Cost",
    power: "Power",
    ram: "RAM",
    type: "Type",
    color: "Color",
    tags: "Affiliations",
    keywords: "Keywords",
    rules: "Rules text",
    flavor: "Flavor text",
    untranslated: "",
    printings: "Printings",
    set: "Set",
    number: "No.",
    rarity: "Rarity",
    language: "Language",
    artist: "Artist",
    price: "Price",
    marketPrice: "Indicative market price",
    priceAsOf: (date: string) => `Cardmarket trend as of ${date}`,
    previous: "Previous card",
    next: "Next card",
    sameColor: (color: string) => `More ${color.toLowerCase()} cards`,
    addToCollection: "Add to my collection",
    backToList: "All cards",
    imageAlt: (name: string) => `${name} card`,
  },
  howToPlay: {
    metaTitle: "How to play Cyberpunk TCG — rules and tutorial",
    metaDescription:
      "Learn to play Cyberpunk TCG: step-by-step tutorial, turn structure, Legends, Units, Programs, Gear and how to win.",
    teaser: {
      eyebrow: "Learn to play",
      title: "Become a Night City legend",
      lead: "Cyberpunk TCG is a two-player card game. You lead a crew of mercs against a Rival, and every turn is a race for the best jobs in the city. Fast, tense games where one well-timed attack can turn everything around.",
      goalTitle: "The goal: 7 Gigs",
      goalBody:
        "Night City's jobs, the Gigs, are represented by dice, from d4 to d20. Start your turn with 7 Gig dice in your area and you win. The catch: each player only has six. To win, you have to steal from your Rival.",
      dice: ["d4", "d6", "d8", "d10", "d12", "d20"],
      diceNote: "Small die, safe gain. Big die, more Street Cred… and a juicier target.",
      cardsTitle: "Four card types",
      cards: [
        {
          type: "Legend",
          body: "The icons of your crew. Your three Legends start face down: reveal them at the right moment to trigger their powers, or spend them like Eddies.",
        },
        {
          type: "Unit",
          body: "Your mercs on the street. They fight enemy Units or go straight for your Rival's Gigs to take them.",
        },
        {
          type: "Program",
          body: "Instant hacks: a decisive boost, an enemy Unit shut down, an attack that changes everything.",
        },
        {
          type: "Gear",
          body: "Weapons and cyberware to equip on a Unit or Legend to make it even deadlier.",
        },
      ],
      turnTitle: "A turn in three beats",
      turn: [
        { title: "Draw", body: "Ready your cards and draw one." },
        { title: "Take a Gig", body: "Pick a die from your Fixer, roll it and add it to your Gigs." },
        { title: "Play and attack", body: "Pay for cards with Eddies, call your Legends, then send your Units in." },
      ],
      fightTitle: "Attack, steal, survive",
      fightBody: [
        "An attacking Unit steals a Gig die from your Rival, even several if its Power is high enough.",
        "But attacking exposes it: once spent, it becomes a target on your Rival's next turn. The stronger Unit wins a fight, and your Rival can strike back with Quick cards or a Blocker.",
        "Your call: when to strike, and when to keep your defenses up.",
      ],
      deckTitle: "Your deck, your style",
      deckBody:
        "Three Legends and 40 to 50 cards. Your Legends' colors set the RAM available for the rest of the deck: every crew has its own identity.",
      ctaTitle: "Ready to play for real?",
      ctaBody:
        "Sign in to start the interactive path: a real guided game against a Rival, move by move, with the full rules at hand. It's free.",
      register: "Create a free account",
      login: "Sign in",
      browseCards: "Browse the cards",
    },
  },
  tournaments: {
    metaTitle: "Cyberpunk TCG tournaments near you",
    metaDescription:
      "Find a Cyberpunk TCG tournament near you: stores, dates, formats, entry fees and seats left. Sign up in one click.",
    crumb: "Tournaments",
    itemTitle: (name: string) => `${name} — Cyberpunk TCG tournament`,
    itemDescription: (parts: string[]) =>
      `Cyberpunk TCG tournament ${parts.join(" · ")}. Details, seats left and sign-up.`,
  },
  shops: {
    metaTitle: "Cyberpunk TCG game stores",
    metaDescription:
      "Game stores running Cyberpunk TCG tournaments near you: addresses, opening hours and upcoming events.",
    crumb: "Shops",
    itemTitle: (name: string, city: string) =>
      `${name}, Cyberpunk TCG store in ${city}`,
    itemDescription: (name: string, city: string) =>
      `${name}, game store in ${city}: upcoming Cyberpunk TCG tournaments, results, address and opening hours.`,
  },
  og: {
    tagline: "Cyberpunk TCG cards, collection and tournaments",
    tournament: "Cyberpunk TCG tournament",
    shop: "Cyberpunk TCG game store",
    free: "Free",
  },
};

export const COPY: Record<SiteLocale, SiteCopy> = { fr, en };
