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
