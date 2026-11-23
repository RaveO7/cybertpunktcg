import { SettingsScreen } from "@/components/SettingsScreen";
import { RequireUser } from "@/components/site/RequireUser";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

/**
 * Écran rendu par le serveur et affiché pendant la vérification de session (seuls le nom et l'e-mail attendent
 * le compte), gardé en place une fois la session confirmée : son texte compte comme LCP dès le premier affichage
 * (comme Tournois). Session refusée : écran de connexion.
 */
export default function SettingsPage() {
  return (
    <RequireUser pending={<SettingsScreen />}>
      <SettingsScreen />
    </RequireUser>
  );
}
