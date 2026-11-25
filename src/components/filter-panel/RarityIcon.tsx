import { useId, type ReactNode } from "react";

/** Bandes obliques qui découpent le cadre du symbole Nova Rare (x + y constant). */
const NOVA_GAPS = [4, 8, 12, 16, 20, 24, 28];

/**
 * Symbole de rareté imprimé en bas des cartes, redessiné en SVG (couleur du texte). Les trois Iconic partagent
 * le même symbole. Espace vide pour « Toutes » ou une rareté inconnue, afin de garder l'alignement.
 */
export function RarityIcon({ rarity }: { rarity: string }) {
  const maskId = useId();
  const kind = rarity.startsWith("Iconic") ? "Iconic" : rarity;
  let shape: ReactNode = null;
  switch (kind) {
    case "Common":
      shape = <path d="M3 5.5 8 10.5 13 5.5" />;
      break;
    case "Uncommon":
      shape = <path d="M3 10.5 8 5.5 13 10.5" />;
      break;
    case "Rare":
      shape = <path d="M3.5 6.8 8 2.3 12.5 6.8M3.5 9.2 8 13.7 12.5 9.2" />;
      break;
    case "Epic":
      shape = (
        <>
          <path d="M3.5 6.8 8 2.3 12.5 6.8M3.5 9.2 8 13.7 12.5 9.2" />
          <path d="M8 6.6 9.4 8 8 9.4 6.6 8Z" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "Nova Rare":
      shape = (
        <>
          <mask id={maskId}>
            <rect width="16" height="16" fill="white" />
            {NOVA_GAPS.map((gap) => (
              <line key={gap} x1={gap} y1="0" x2={gap - 16} y2="16" stroke="black" strokeWidth="1.4" />
            ))}
          </mask>
          <rect x="3" y="3" width="10" height="10" strokeWidth="2.2" mask={`url(#${maskId})`} />
          <rect x="6.9" y="6.9" width="2.2" height="2.2" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "Secret":
      shape = (
        <>
          <path d="M5.2 3.6 1.8 8l3.4 4.4M10.8 3.6 14.2 8l-3.4 4.4" />
          <path d="M8 4.8 11.2 8 8 11.2 4.8 8Z" strokeWidth="1.3" />
          <path d="M8 7.1 8.9 8 8 8.9 7.1 8Z" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "Iconic":
      shape = (
        <>
          <path d="M2.2 7.2 5 4.4M2.2 8.8 5 11.6M13.8 7.2 11 4.4M13.8 8.8 11 11.6" />
          <path d="M8 1.8v2.8M8 14.2v-2.8" strokeWidth="2.2" />
          <path d="M5.2 7.3 8 4.5l2.8 2.8M5.2 8.7 8 11.5l2.8-2.8" />
          <path d="M8 7 9 8 8 9 7 8Z" fill="currentColor" stroke="none" />
        </>
      );
      break;
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      {shape}
    </svg>
  );
}
