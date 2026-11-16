// Tuile de carte des pages publiques (catalogue et fiche), rendue au serveur.

import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { THUMB, TILE_CLASSES } from "@/components/public-site/tile-reveal";
import { thumbnailSrcSet } from "@/lib/card-image";

/** Ce qu'il faut d'une carte pour sa tuile. */
export type TileCard = { slug: string; name: string; href: string; alt: string; image: string | null; thumb: string | null };

/**
 * Tuile de carte reprenant celle de l'explorateur : halo aux couleurs de l'illustration, balayage et
 * zoom au survol (effets réservés à la souris, cf. globals.css).
 * `light` : même cadre et même lien, sans image ni halo ; les données de l'image restent en attributs
 * `data-*`, la grille du catalogue (CatalogGrid) l'ajoute à l'approche de l'écran.
 */
export function CatalogCardTile({ card, sizes, eager = false, light = false }: { card: TileCard; sizes: string; eager?: boolean; light?: boolean }) {
  const deferred = light && card.thumb !== null;
  const withImage = card.thumb !== null && !light;
  // Halos et tuile partagent srcset et sizes : une seule image téléchargée.
  const srcSet = withImage ? thumbnailSrcSet(card.image) : undefined;
  return (
    <li
      className="group relative"
      data-thumb={deferred ? (card.thumb ?? undefined) : undefined}
      data-image={deferred ? (card.image ?? undefined) : undefined}
      data-alt={deferred ? card.alt : undefined}
    >
      {withImage ? (
        <>
          <div className={TILE_CLASSES.haloBack} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la tuile */}
            <img srcSet={srcSet} sizes={sizes} src={card.thumb ?? undefined} alt="" loading="lazy" decoding="async" className={TILE_CLASSES.haloImage} />
          </div>
          <div className={TILE_CLASSES.haloSpill} aria-hidden="true">
            <div className={TILE_CLASSES.haloSpillInner}>
              {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la tuile */}
              <img srcSet={srcSet} sizes={sizes} src={card.thumb ?? undefined} alt="" loading="lazy" decoding="async" className={TILE_CLASSES.haloImage} />
            </div>
          </div>
        </>
      ) : null}
      <Link
        href={card.href}
        className="hud-panel relative z-0 flex h-full flex-col overflow-hidden transition-colors hover:border-cyan/70 focus-visible:border-cyan"
      >
        <div className="relative aspect-card overflow-hidden bg-overlay scanlines scanbeam">
          {withImage ? (
            // Composant client : préchargée depuis une autre page, cette page ne télécharge pas ses tuiles.
            <CardImage
              src={card.image ?? card.thumb ?? ""}
              sizes={sizes}
              alt={card.alt}
              width={THUMB.width}
              height={THUMB.height}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className={TILE_CLASSES.image}
            />
          ) : null}
        </div>
        <p className="truncate p-2 text-xs font-bold text-foreground">{card.name}</p>
      </Link>
    </li>
  );
}
