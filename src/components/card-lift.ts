/*
 * Carte soulevée du tutoriel (cf. specs/tutorial/card-inspection) : rectangle de la copie agrandie,
 * affichée dans un calque fixe au-dessus du plateau, et place de la fiche zoom autour d'elle.
 */

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

export const LIFT_SCALE = 1.1;
const CARD_RATIO = 1.4;
/** Écart entre la carte soulevée et la fiche zoom. */
const GAP = 12;
/** Marge minimale avec les bords de l'écran. */
const MARGIN = 8;
/** Hauteur estimée du texte sous l'image de la fiche, avant de pouvoir la mesurer. */
const ZOOM_INFO = 96;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

/**
 * Carte soulevée : droite, centrée sur la carte d'origine (`bbox`, transformations comprises),
 * agrandie à partir de sa largeur de mise en page, et ramenée dans l'écran.
 */
export function liftRect(bbox: Rect, layoutWidth: number, viewport: Size): Rect {
  const width = layoutWidth * LIFT_SCALE;
  const height = width * CARD_RATIO;
  const left = bbox.left + bbox.width / 2 - width / 2;
  const top = bbox.top + bbox.height / 2 - height / 2;
  return {
    left: clamp(left, 0, Math.max(0, viewport.width - width)),
    top: clamp(top, 0, Math.max(0, viewport.height - height)),
    width,
    height,
  };
}

/** Taille de la fiche zoom : `measuredHeight` (hauteur réelle une fois affichée) prime sur l'estimation. */
export function zoomSize(viewport: Size, measuredHeight = 0): Size {
  const width = Math.max(
    110,
    Math.min(240, Math.max(176, viewport.width * 0.14), (viewport.height - 2 * MARGIN - ZOOM_INFO) / CARD_RATIO),
  );
  return { width, height: Math.max(width * CARD_RATIO + ZOOM_INFO, measuredHeight) };
}

/** Coin haut-gauche de la fiche zoom : au-dessus de la carte, sinon en dessous, sinon à côté. */
export function placeZoom(card: Rect, zoom: Size, viewport: Size): { x: number; y: number } {
  const centeredX = clamp(card.left + card.width / 2 - zoom.width / 2, MARGIN, viewport.width - zoom.width - MARGIN);

  const above = card.top - GAP - zoom.height;
  if (above >= MARGIN) return { x: centeredX, y: above };

  const below = card.top + card.height + GAP;
  if (below + zoom.height <= viewport.height - MARGIN) return { x: centeredX, y: below };

  // Ni au-dessus ni en dessous : à côté, du côté qui a la place (sinon celui qui en a le plus).
  const y = clamp(card.top + card.height / 2 - zoom.height / 2, MARGIN, viewport.height - zoom.height - MARGIN);
  const right = card.left + card.width + GAP;
  const left = card.left - GAP - zoom.width;
  if (right + zoom.width <= viewport.width - MARGIN) return { x: right, y };
  if (left >= MARGIN) return { x: left, y };
  return { x: viewport.width - right >= card.left ? right : left, y };
}
