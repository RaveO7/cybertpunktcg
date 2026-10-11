import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalPage, LegalSection } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation · Collection Cyberpunk TCG",
};

export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales d’utilisation">
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions encadrent l’utilisation de {SITE.name}, un outil gratuit permettant de consulter les
          cartes du jeu Cyberpunk TCG, de suivre sa collection, de construire des decks et d’organiser des tournois.
          Utiliser le site vaut acceptation de ces conditions.
        </p>
      </LegalSection>
      <LegalSection title="2. Compte">
        <ul>
          <li>La création d’un compte est gratuite (e-mail et mot de passe, ou connexion Google / Apple).</li>
          <li>Vous êtes responsable de la confidentialité de votre mot de passe et des actions faites depuis votre compte.</li>
          <li>Les informations fournies doivent être exactes ; un nom affiché ne doit pas usurper l’identité d’un tiers.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Utilisation acceptable">
        <p>Il est interdit :</p>
        <ul>
          <li>de perturber le service (requêtes automatisées massives, contournement des limites, tentative d’intrusion) ;</li>
          <li>de publier des noms de deck, de tournoi ou de joueur injurieux, haineux ou illicites ;</li>
          <li>de réutiliser les données du site à des fins commerciales sans accord.</li>
        </ul>
        <p>Un compte qui ne respecte pas ces règles peut être suspendu ou supprimé.</p>
      </LegalSection>
      <LegalSection title="4. Partage et tournois">
        <p>
          Un lien de partage de classeur rend votre collection visible en lecture seule à toute personne qui le
          possède (sans prix d’achat ni notes). Vous pouvez le régénérer ou le révoquer à tout moment depuis les
          paramètres. Les noms des participants et les résultats d’un tournoi sont visibles des autres joueurs de ce
          tournoi.
        </p>
      </LegalSection>
      <LegalSection title="5. Données et prix affichés">
        <p>
          Les données des cartes et les prix (guide Cardmarket) sont fournis à titre indicatif. Les valeurs de
          collection et les courbes d’investissement sont des estimations et ne constituent pas un conseil financier.
        </p>
      </LegalSection>
      <LegalSection title="6. Disponibilité et responsabilité">
        <p>
          Le service est fourni gratuitement, « en l’état », sans garantie de disponibilité continue. L’éditeur ne peut
          être tenu responsable d’une perte de données : pensez à exporter régulièrement votre collection (export CSV).
        </p>
      </LegalSection>
      <LegalSection title="7. Données personnelles">
        <p>
          Le traitement de vos données est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>
      <LegalSection title="8. Modification et droit applicable">
        <p>
          Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de la page. Elles sont soumises au droit
          français. Pour toute question : <LegalContact />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
