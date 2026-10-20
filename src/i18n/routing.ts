import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/config";

/**
 * URL de chaque page dans chaque langue, toujours préfixée par la langue (« /fr/cartes », « /de/karten »).
 * Les dossiers de src/app/[locale]/ portent les segments français, qui servent d'identifiants de route ;
 * chaque langue peut traduire ses segments. Une route absente de cette liste n'a pas de lien typé.
 *
 * Ordre significatif : à segments égaux, next-intl essaie les entrées dans cet ordre. « /cartes »
 * vient avant « /cards » pour qu'un ancien chemin « /de/cards/… » renvoie vers la liste des cartes.
 */
export const pathnames = {
  "/": "/",

  // Pages publiques indexées.
  "/cartes": { fr: "/cartes", en: "/cards", de: "/karten", es: "/cartas", it: "/carte" },
  "/cartes/[slug]": {
    fr: "/cartes/[slug]",
    en: "/cards/[slug]",
    de: "/karten/[slug]",
    es: "/cartas/[slug]",
    it: "/carte/[slug]",
  },
  "/tournois/publics/[id]": {
    fr: "/tournois/publics/[id]",
    en: "/tournaments/[id]",
    de: "/turniere/[id]",
    es: "/torneos/[id]",
    it: "/tornei/[id]",
  },
  "/boutiques/[slug]": {
    fr: "/boutiques/[slug]",
    en: "/shops/[slug]",
    de: "/shops/[slug]",
    es: "/tiendas/[slug]",
    it: "/negozi/[slug]",
  },

  // Pages légales.
  "/mentions-legales": {
    fr: "/mentions-legales",
    en: "/legal-notice",
    de: "/impressum",
    es: "/aviso-legal",
    it: "/note-legali",
  },
  "/cgu": { fr: "/cgu", en: "/terms", de: "/nutzungsbedingungen", es: "/condiciones", it: "/termini" },
  "/confidentialite": {
    fr: "/confidentialite",
    en: "/privacy",
    de: "/datenschutz",
    es: "/privacidad",
    it: "/privacy",
  },

  // Explorateur de cartes de l'application : « /cards » en français, « /explorer » ailleurs, pour
  // laisser « /en/cards » à la liste publique.
  "/cards": { fr: "/cards", en: "/explorer", de: "/explorer", es: "/explorer", it: "/explorer" },

  // Écrans de l'application : même chemin dans toutes les langues (« /decks », « /de/decks »).
  "/admin/boutiques": "/admin/boutiques",
  "/boutiques": "/boutiques",
  "/classeur/[token]": "/classeur/[token]",
  "/classeur/[token]/cartes": "/classeur/[token]/cartes",
  "/comment-jouer": "/comment-jouer",
  "/compte/boutique": "/compte/boutique",
  "/connexion": "/connexion",
  "/deck/[token]": "/deck/[token]",
  "/decks": "/decks",
  "/investissement": "/investissement",
  "/parametres": "/parametres",
  "/souhaits": "/souhaits",
  "/t/[code]": "/t/[code]",
  "/t/claim/[token]": "/t/claim/[token]",
  "/tournois": "/tournois",
  "/tournois/[id]": "/tournois/[id]",
  "/tournois/invitation/[token]": "/tournois/invitation/[token]",
  "/tournois/publics": "/tournois/publics",
} as const;

/** Ancres des annuaires (tournois, boutiques) sur l'accueil des visiteurs (« /de#turniere »). */
export const landingSections: Record<Locale, Record<"tournaments" | "shops", string>> = {
  fr: { tournaments: "tournois", shops: "boutiques" },
  en: { tournaments: "tournaments", shops: "shops" },
  de: { tournaments: "turniere", shops: "shops" },
  es: { tournaments: "torneos", shops: "tiendas" },
  it: { tournaments: "tornei", shops: "negozi" },
};

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Toutes les langues sous leur code, français compris (« /fr »).
  localePrefix: "always",
  // Jamais de redirection automatique selon le navigateur : visiteurs et robots reçoivent l'URL demandée.
  localeDetection: false,
  // La préférence (cookie cptcg-locale) n'est écrite que par un choix explicite, jamais par la visite
  // d'une URL : le cookie de next-intl est désactivé.
  localeCookie: false,
  // Les alternatives sont déclarées dans le HTML (métadonnées), pas dans un en-tête Link.
  alternateLinks: false,
  pathnames,
});

export type AppPathname = keyof typeof pathnames;
