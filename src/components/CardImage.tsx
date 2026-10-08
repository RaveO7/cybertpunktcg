"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { thumbnailPath } from "@/lib/card-image";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string };

/**
 * Affiche la miniature pré-générée d'une carte et repasse sur l'image d'origine
 * si la miniature est absente ou ne se charge pas.
 */
export function CardImage({ src, onError, ...props }: Props) {
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
      src={useThumb ? thumb : src}
      onError={(event) => {
        if (useThumb) setFailedSrc(src);
        else onError?.(event);
      }}
    />
  );
}
