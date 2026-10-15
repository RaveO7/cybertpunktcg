import type { Messages } from "@/i18n/load";

/**
 * Blocs transmis au navigateur sur toutes les pages : ceux des composants clients de l'application
 * (navigation, écrans, formulaires). Les blocs des pages publiques rendues côté serveur (accueil,
 * catalogue, fiches, partage), des règles et des pages légales n'y sont pas : ils sont lus côté
 * serveur, ou transmis par la mise en page des seules pages qui les utilisent.
 */
export const CLIENT_BLOCKS = [
  "auth",
  "cards",
  "chart",
  "common",
  "dashboard",
  "decks",
  "errors",
  "filters",
  "footer",
  "geo",
  "header",
  "investment",
  "modal",
  "nav",
  "offline",
  "publicTournaments",
  "settings",
  "share",
  "shops",
  "tournaments",
  "wishlist",
] as const satisfies readonly (keyof Messages)[];

/** Sous-ensemble des messages limité à certains blocs. */
export function pickBlocks<K extends keyof Messages>(messages: Messages, blocks: readonly K[]): Pick<Messages, K> {
  return Object.fromEntries(blocks.map((block) => [block, messages[block]])) as Pick<Messages, K>;
}
