/** Informations publiques du site : pied de page et pages légales. */

export type SocialNetwork = "discord" | "x" | "instagram" | "youtube" | "tiktok" | "bluesky";

/** Réseaux affichés dans le pied de page. Une entrée sans `href` est masquée. */
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
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    url: "https://vercel.com",
  },
  /** Date de dernière mise à jour des pages légales. */
  legalUpdatedAt: "11 octobre 2026",
};

export const LEGAL_LINKS = [
  { href: "/mentions-legales", key: "legal" },
  { href: "/cgu", key: "terms" },
  { href: "/confidentialite", key: "privacy" },
] as const;

export const LEGAL_PATHS: readonly string[] = LEGAL_LINKS.map((link) => link.href);
