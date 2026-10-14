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
  fr: { Legend: "Légendes", Unit: "Unités", Program: "Programmes", Gear: "Équipements" },
  en: { Legend: "Legends", Unit: "Units", Program: "Programs", Gear: "Gear" },
};

/** Types de carte du jeu, dans l'ordre des sections de la liste des cartes. */
export const CARD_TYPES = ["Legend", "Unit", "Program", "Gear"] as const;

export function typePlural(locale: SiteLocale, type: string) {
  return TYPE_PLURALS[locale][type] ?? type;
}

export function colorLabel(locale: SiteLocale, color: string | null) {
  return color ? (COLOR_LABELS[locale][color] ?? color) : null;
}

export function typeLabel(locale: SiteLocale, type: string | null) {
  return type ? (TYPE_LABELS[locale][type] ?? type) : null;
}

const fr = {
  intl: "fr-FR",
  breadcrumb: { label: "Fil d'Ariane", home: "Accueil" },
  nav: {
    cards: "Cartes",
  },
  catalog: {
    title: "Liste des cartes Cyberpunk TCG",
    metaTitle: "Liste des cartes Cyberpunk TCG",
    metaDescription: (count: number) =>
      `Les ${count} cartes du jeu Cyberpunk TCG : Légendes, Unités, Programmes et Équipements, avec texte de règles, coût, puissance, RAM, impressions et prix.`,
    intro: (count: number) =>
      `Les ${count} cartes du jeu de cartes Cyberpunk TCG, classées par type puis dans l'ordre de la liste officielle. Chaque fiche donne le texte de règles, le coût, la puissance, la RAM, les impressions et le prix de marché Cardmarket.`,
    sections: "Types de cartes",
    other: "Autres cartes",
    track: "Suivre ma collection",
  },
  landing: {
    eyebrow: "Cyberpunk TCG · outil de fans gratuit",
    title:
      "Toutes les cartes Cyberpunk TCG, votre collection et les tournois près de chez vous",
    lead: "TCG Tracker réunit le catalogue complet du jeu de cartes Cyberpunk TCG, le suivi de votre collection et de sa valeur, vos decks, et un annuaire des tournois et boutiques. Gratuit, sans publicité.",
    register: "Créer un compte gratuit",
    login: "Se connecter",
    openApp: "Ouvrir l'application",
    featuresTitle: "Ce que vous pouvez faire",
    modulesLabel: "Modules",
    findLabel: "Sur le terrain",
    findTitle: "Trouver une partie près de chez vous",
    findBody: "Les tournois annoncés par les boutiques et les joueurs, et les boutiques qui font vivre le jeu.",
    tabTournaments: "Tournois",
    tabShops: "Boutiques",
    fanLabel: "Quelques Légendes du jeu",
    cardClose: "Fermer la fiche",
    features: [
      {
        key: "collection",
        title: "Suivi de collection",
        body: "Ajoutez vos cartes en quelques clics, même par plages entières, et suivez ce que vaut votre collection.",
        points: ["État et prix d'achat de chaque exemplaire", "Valeur au prix Cardmarket et son évolution", "Import CSV et partage de votre classeur par lien"],
      },
      {
        key: "decks",
        title: "Construction de decks",
        body: "Montez vos decks : l'application vérifie les règles de construction pour vous.",
        points: ["3 Légendes, 40 à 50 cartes, 3 exemplaires au plus", "Plafond de RAM par couleur calculé automatiquement", "Les cartes qui vous manquent et leur coût"],
      },
      {
        key: "tournaments",
        title: "Tournois",
        body: "Trouvez un tournoi près de chez vous, ou organisez le vôtre en boutique ou entre amis.",
        points: ["Inscription en un clic ou avec un code", "Rondes suisses en Bo1 ou Bo3, chrono de ronde", "Appariements et classement en direct"],
      },
      {
        key: "cards",
        title: "Catalogue complet",
        body: "Toutes les cartes du jeu, avec leur texte, leurs impressions et leur prix de marché.",
        points: ["Cartes en français et en anglais", "Coût, puissance, RAM et texte de règles", "Impressions, raretés et prix Cardmarket"],
      },
      {
        key: "shops",
        title: "Boutiques",
        body: "Les boutiques qui font vivre le jeu, et leurs prochains événements.",
        points: ["Adresse, horaires et carte", "Prochains tournois de chaque boutique", "Badge des boutiques vérifiées"],
      },
      {
        key: "howToPlay",
        title: "Apprendre à jouer",
        body: "Une vraie partie guidée contre un Rival, coup par coup, puis les règles complètes.",
        points: ["Parcours interactif pas à pas", "Zones du tapis et lecture d'une carte", "Règles complètes et glossaire"],
      },
    ],
    preview: "Aperçu",
    example: "Exemple",
    open: "Découvrir",
    finalTitle: "Prêt à suivre votre collection ?",
    finalBody:
      "Créez un compte gratuit et retrouvez vos cartes sur tous vos appareils, même hors ligne.",
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
  tournaments: {
    crumb: "Tournois",
    itemTitle: (name: string) => `${name} — tournoi Cyberpunk TCG`,
    itemDescription: (parts: string[]) =>
      `Tournoi Cyberpunk TCG ${parts.join(" · ")}. Infos, places restantes et inscription.`,
  },
  shops: {
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
  },
  catalog: {
    title: "Cyberpunk TCG card list",
    metaTitle: "Cyberpunk TCG card list",
    metaDescription: (count: number) =>
      `All ${count} Cyberpunk TCG cards: Legends, Units, Programs and Gear, with rules text, cost, power, RAM, printings and prices.`,
    intro: (count: number) =>
      `All ${count} cards of the Cyberpunk TCG card game, sorted by type, then in official list order. Each card page shows its rules text, cost, power, RAM, printings and Cardmarket market price.`,
    sections: "Card types",
    other: "Other cards",
    track: "Track my collection",
  },
  landing: {
    eyebrow: "Cyberpunk TCG · free fan-made tool",
    title: "Every Cyberpunk TCG card, your collection and tournaments near you",
    lead: "TCG Tracker brings together the full Cyberpunk TCG card list, collection and value tracking, deck building, and a directory of tournaments and game stores. Free, no ads.",
    register: "Create a free account",
    login: "Log in",
    openApp: "Open the app",
    featuresTitle: "What you can do",
    modulesLabel: "Modules",
    findLabel: "Out in the streets",
    findTitle: "Find a game near you",
    findBody: "Tournaments announced by stores and players, and the stores that keep the game alive.",
    tabTournaments: "Tournaments",
    tabShops: "Stores",
    fanLabel: "Some of the game's Legends",
    cardClose: "Close",
    features: [
      {
        key: "collection",
        title: "Collection tracking",
        body: "Add your cards in a few clicks, even whole ranges at once, and see what your collection is worth.",
        points: ["Condition and purchase price of every copy", "Value at Cardmarket prices, and how it moves", "CSV import and share your binder with a link"],
      },
      {
        key: "decks",
        title: "Deck building",
        body: "Build your decks: the app checks the deckbuilding rules for you.",
        points: ["3 Legends, 40 to 50 cards, 3 copies at most", "RAM limit per color worked out for you", "The cards you're missing and what they cost"],
      },
      {
        key: "tournaments",
        title: "Tournaments",
        body: "Find a tournament near you, or run your own at a store or with friends.",
        points: ["Sign up in one click or with a code", "Swiss rounds in Bo1 or Bo3, round timer", "Live pairings and standings"],
      },
      {
        key: "cards",
        title: "Full card list",
        body: "Every card in the game, with its text, printings and market price.",
        points: ["Cards in French and English", "Cost, power, RAM and rules text", "Printings, rarities and Cardmarket prices"],
      },
      {
        key: "shops",
        title: "Game stores",
        body: "The stores that keep the game alive, and their next events.",
        points: ["Address, opening hours and map", "Upcoming tournaments at each store", "Verified store badge"],
      },
      {
        key: "howToPlay",
        title: "Learn to play",
        body: "A real guided game against a Rival, move by move, then the full rules.",
        points: ["Interactive step-by-step path", "Playmat zones and how to read a card", "Full rules and glossary"],
      },
    ],
    preview: "Preview",
    example: "Example",
    open: "Explore",
    finalTitle: "Ready to track your collection?",
    finalBody:
      "Create a free account and find your cards on all your devices, even offline.",
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
  tournaments: {
    crumb: "Tournaments",
    itemTitle: (name: string) => `${name} — Cyberpunk TCG tournament`,
    itemDescription: (parts: string[]) =>
      `Cyberpunk TCG tournament ${parts.join(" · ")}. Details, seats left and sign-up.`,
  },
  shops: {
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
