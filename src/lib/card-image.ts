// Miniatures des images de cartes, pré-générées au build par scripts/generate-thumbnails.ts
// (aucune transformation Vercel Image Optimization, donc aucun quota consommé).

export const CARD_IMAGES_PREFIX = "/card-images/";
export const THUMB_DIR = "thumb";
export const THUMB_WIDTH = 400;
/** Autres largeurs, rangées dans thumb/<largeur>/ : le navigateur choisit dans le srcset celle qui suffit à l'affichage. */
export const THUMB_EXTRA_WIDTHS = [160, 200, 240, 320, 560] as const;

/** Chemin de la miniature d'une image locale de carte, ou null si l'image n'en a pas. */
export function thumbnailPath(src: string | null | undefined): string | null {
  if (!src || !src.startsWith(CARD_IMAGES_PREFIX)) return null;
  const name = src.slice(CARD_IMAGES_PREFIX.length).split(/[?#]/)[0];
  if (!name || name.includes("/")) return null;
  return `${CARD_IMAGES_PREFIX}${THUMB_DIR}/${name.replace(/\.[^.]+$/, "")}.webp`;
}

/** Chemin d'une miniature de la largeur donnée, à partir de celle de THUMB_WIDTH. */
export function sizedThumbnailPath(thumb: string, width: number): string {
  if (width === THUMB_WIDTH) return thumb;
  const file = thumb.slice(thumb.lastIndexOf("/") + 1);
  return `${CARD_IMAGES_PREFIX}${THUMB_DIR}/${width}/${file}`;
}

/**
 * srcset des miniatures d'une image locale de carte, à associer à un `sizes` juste ; avec
 * `originalWidth`, l'image d'origine termine la liste (grands affichages). undefined sans miniature.
 */
export function thumbnailSrcSet(src: string | null | undefined, originalWidth?: number): string | undefined {
  const thumb = thumbnailPath(src);
  if (!thumb || !src) return undefined;
  const widths = [...THUMB_EXTRA_WIDTHS, THUMB_WIDTH].sort((a, b) => a - b);
  const entries = widths.map((width) => `${sizedThumbnailPath(thumb, width)} ${width}w`);
  if (originalWidth) entries.push(`${src} ${originalWidth}w`);
  return entries.join(", ");
}
