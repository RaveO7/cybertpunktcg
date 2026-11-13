"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { thumbnailPath, thumbnailSrcSet } from "@/lib/card-image";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  /** Largeur de l'image d'origine : l'ajoute au srcset, pour un affichage plus large que les miniatures. */
  originalWidth?: number;
};

/**
 * Affiche la miniature pré-générée d'une carte et repasse sur l'image d'origine
 * si la miniature est absente ou ne se charge pas. Avec `sizes` (largeur affichée), le navigateur
 * choisit la largeur de miniature qui suffit (srcset).
 * Composant client : rendu dans une page serveur, il n'ajoute pas d'indice de préchargement au flux RSC,
 * donc le préchargement d'un lien vers cette page ne télécharge pas l'image (le HTML de la page la précharge).
 */
export function CardImage({ src, sizes, originalWidth, onError, ...props }: Props) {
  const thumb = thumbnailPath(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const useThumb = thumb !== null && failedSrc !== src;

  // Une erreur survenue avant l'hydratation n'appelle pas onError : on la détecte ici.
  useEffect(() => {
    const img = ref.current;
    if (useThumb && img?.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src, useThumb]);

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      ref={ref}
      {...props}
      // srcset et sizes avant src : sinon Safari peut télécharger src en plus de la bonne largeur.
      srcSet={useThumb && sizes ? thumbnailSrcSet(src, originalWidth) : undefined}
      sizes={useThumb ? sizes : undefined}
      src={useThumb ? thumb : src}
      onError={(event) => {
        if (useThumb) setFailedSrc(src);
        else onError?.(event);
      }}
    />
  );
}
