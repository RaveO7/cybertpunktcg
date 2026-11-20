// Classes et images d'une tuile de carte : partagées par la tuile rendue au serveur (CatalogCardTile)
// et par l'ajout des images d'une tuile allégée dans le navigateur (CatalogGrid).

import { thumbnailPath, thumbnailSrcSet } from "@/lib/card-image";

export const THUMB = { width: 400, height: 559 };

export const TILE_CLASSES = {
  haloBack: "pointer-events-none absolute inset-0 -z-10",
  haloSpill: "card-ambilight-spill z-[1]",
  haloSpillInner: "relative h-full",
  haloImage: "card-ambilight",
  image: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, attributes: Record<string, string> = {}) {
  const node = document.createElement(tag);
  node.className = className;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/**
 * Tuile allégée (rendue au serveur sans image, données en `data-image`, `data-thumb`, `data-alt`) :
 * ajoute les halos et l'image, avec le même balisage que la tuile complète de CatalogCardTile.
 * Hors de React : la grille n'a rien à rendre dans le navigateur, seule cette fonction s'exécute.
 */
export function revealTile(tile: HTMLElement, sizes: string) {
  const { image, thumb, alt } = tile.dataset;
  const frame = tile.querySelector("a > div");
  if (!thumb || !frame) return;
  delete tile.dataset.image;
  delete tile.dataset.thumb;
  delete tile.dataset.alt;

  // Halos : même miniature que la tuile (srcset et sizes identiques, une seule image téléchargée).
  const halo = () =>
    element("img", TILE_CLASSES.haloImage, { srcset: thumbnailSrcSet(image) ?? "", sizes, src: thumb, alt: "", loading: "lazy", decoding: "async" });
  const back = element("div", TILE_CLASSES.haloBack, { "aria-hidden": "true" });
  back.append(halo());
  const spill = element("div", TILE_CLASSES.haloSpill, { "aria-hidden": "true" });
  const spillInner = element("div", TILE_CLASSES.haloSpillInner);
  spillInner.append(halo());
  spill.append(spillInner);
  tile.prepend(back, spill);

  // Image de la tuile, comme CardImage : miniature et srcset, repli sur l'image d'origine si la miniature manque.
  const source = image ?? thumb;
  const picture = element("img", TILE_CLASSES.image, {
    alt: alt ?? "",
    width: String(THUMB.width),
    height: String(THUMB.height),
    loading: "lazy",
    decoding: "async",
  });
  const small = thumbnailPath(source);
  if (small) {
    picture.srcset = thumbnailSrcSet(source) ?? "";
    picture.sizes = sizes;
    picture.addEventListener(
      "error",
      () => {
        picture.removeAttribute("srcset");
        picture.removeAttribute("sizes");
        picture.src = source;
      },
      { once: true },
    );
  }
  picture.src = small ?? source;
  frame.append(picture);
}
