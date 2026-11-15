// Tuile de carte des pages publiques : rendue côté serveur (fiche) comme dans la grille client du catalogue.

import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { thumbnailSrcSet } from "@/lib/card-image";

const THUMB = { width: 400, height: 559 };

/** Ce qu'il faut d'une carte pour sa tuile (props sérialisées vers la grille client du catalogue). */
export type TileCard = { slug: string; name: string; href: string; alt: string; image: string | null; thumb: string | null };

/**
 * Tuile de carte reprenant celle de l'explorateur : halo aux couleurs de l'illustration, balayage et
 * zoom au survol (effets réservés à la souris, cf. globals.css).
 * `light` : même cadre et même lien, sans image ni halo (tuile pas encore affichée en entier).
 */
export function CatalogCardTile({
  card,
  sizes,
  eager = false,
  light = false,
}: {
  card: TileCard;
  sizes: string;
  eager?: boolean;
  light?: boolean;
}) {
  const withImage = card.thumb !== null && !light;
  // Halos et tuile partagent srcset et sizes : une seule image téléchargée.
  const srcSet = withImage ? thumbnailSrcSet(card.image) : undefined;
  return (
    <li className="group relative">
      {withImage ? (
        <>
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la tuile */}
            <img srcSet={srcSet} sizes={sizes} src={card.thumb ?? undefined} alt="" loading="lazy" decoding="async" className="card-ambilight" />
          </div>
          <div className="card-ambilight-spill z-[1]" aria-hidden="true">
            <div className="relative h-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la tuile */}
              <img srcSet={srcSet} sizes={sizes} src={card.thumb ?? undefined} alt="" loading="lazy" decoding="async" className="card-ambilight" />
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
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
        </div>
        <p className="truncate p-2 text-xs font-bold text-foreground">{card.name}</p>
      </Link>
    </li>
  );
}
