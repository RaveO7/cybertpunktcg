/** Informations publiques du site : pied de page et pages légales. */

export type SocialNetwork = "discord" | "x" | "instagram" | "youtube" | "tiktok" | "bluesky";

/** Réseaux affichés dans le pied de page. Une entrée sans `href` montre son icône sans lien. */
export const SOCIAL_LINKS: { network: SocialNetwork; label: string; href: string }[] = [
  { network: "discord", label: "Discord", href: "" },
  { network: "x", label: "X (Twitter)", href: "" },
  { network: "instagram", label: "Instagram", href: "" },
  { network: "youtube", label: "YouTube", href: "" },
  { network: "tiktok", label: "TikTok", href: "" },
  { network: "bluesky", label: "Bluesky", href: "" },
];

export const SITE = {
  name: "TCG Tracker",
  /** Éditeur du site (nom ou pseudonyme), cité dans les mentions légales. */
  publisher: "RaveO7",
  /** Adresse de contact affichée dans les pages légales (vide = masquée). */
  contactEmail: "",
  host: {
    name: "Vercel Inc.",
    /** Adresse sans le pays, ajouté dans la langue de la page (bloc legal). */
    address: "440 N Barranca Ave #4133, Covina, CA 91723",
    url: "https://vercel.com",
  },
  /** Date de dernière mise à jour des pages légales (AAAA-MM-JJ, affichée au format de la langue). */
  legalUpdatedAt: "2026-10-11",
};

/**
 * Liste de souhaits et alertes de prix : pas encore publiée. À false, le bloc de la fenêtre d'une
 * carte est masqué et /souhaits répond 404 (l'API et les données restent en place).
 */
export const WISHLIST_ENABLED = false;

export const LEGAL_LINKS = [
  { href: "/mentions-legales", key: "legal" },
  { href: "/cgu", key: "terms" },
  { href: "/confidentialite", key: "privacy" },
] as const;

export const LEGAL_PATHS: readonly string[] = LEGAL_LINKS.map((link) => link.href);
