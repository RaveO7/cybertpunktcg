import { RequireUser } from "@/components/site/RequireUser";
import { TournamentsScreen } from "@/components/tournament/TournamentsScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

/**
 * Écran rendu par le serveur et affiché pendant la vérification de session (rien n'y dépend du compte, la
 * liste des tournois se charge ensuite) : le même écran reste en place une fois la session confirmée, son
 * texte compte comme LCP dès le premier affichage. Session refusée : écran de connexion.
 */
export default function TournamentsPage() {
  return (
    <RequireUser pending={<TournamentsScreen />}>
      <TournamentsScreen />
    </RequireUser>
  );
}
