// Miniatures des images de cartes, pré-générées au build par scripts/generate-thumbnails.ts
// (aucune transformation Vercel Image Optimization, donc aucun quota consommé).

export const CARD_IMAGES_PREFIX = "/card-images/";
export const THUMB_DIR = "thumb";
export const THUMB_WIDTH = 400;

/** Chemin de la miniature d'une image locale de carte, ou null si l'image n'en a pas. */
export function thumbnailPath(src: string | null | undefined): string | null {
  if (!src || !src.startsWith(CARD_IMAGES_PREFIX)) return null;
  const name = src.slice(CARD_IMAGES_PREFIX.length).split(/[?#]/)[0];
  if (!name || name.includes("/")) return null;
  return `${CARD_IMAGES_PREFIX}${THUMB_DIR}/${name.replace(/\.[^.]+$/, "")}.webp`;
}
