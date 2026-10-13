import { HowToPlayScreen } from "@/components/HowToPlayScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Règles et parcours interactif, réservés aux comptes (visiteurs renvoyés vers l'accueil par src/proxy.ts).
export const metadata = privateMetadata;

export default function HowToPlayRoute() {
  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      <HowToPlayScreen />
    </div>
  );
}
