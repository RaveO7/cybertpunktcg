import type { ComponentProps } from "react";
import { CardModal } from "@/components/CardModal";

/**
 * Fiche carte de l'investissement, chargée à part (InvestmentScreen) : un module distinct de CardModal, pas
 * un import direct. Un même `import()` présent sur deux pages existe en deux variantes de fichiers, et le
 * navigateur garde la première déclarée (souvent celle de la page préchargée par la navigation) : la collection,
 * qui charge aussi CardModal à part, demanderait hors ligne des fichiers jamais mis en cache.
 */
export function InvestmentCardModal(props: ComponentProps<typeof CardModal>) {
  return <CardModal {...props} />;
}
