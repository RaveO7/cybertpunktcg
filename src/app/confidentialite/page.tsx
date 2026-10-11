import type { Metadata } from "next";
import { LegalContact, LegalPage, LegalSection } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité · Collection Cyberpunk TCG",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="Responsable du traitement">
        <p>
          {SITE.publisher}, éditeur de {SITE.name}. Contact : <LegalContact />.
        </p>
      </LegalSection>
      <LegalSection title="Données collectées">
        <ul>
          <li>
            <strong>Compte</strong> : adresse e-mail, nom affiché, mot de passe
            ou identifiant Google / Apple si vous utilisez ces connexions.
          </li>
          <li>
            <strong>Contenu</strong> : collection, prix d’achat et notes, liste de souhaits, decks, liens de partage,
            participation aux tournois.
          </li>
          <li>
            <strong>Technique</strong> : adresse IP utilisée temporairement pour limiter les tentatives de connexion,
            journaux techniques de l’hébergeur.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="Finalités et base légale">
        <p>
          Ces données servent uniquement à fournir le service (exécution des conditions d’utilisation) et à le protéger
          contre les abus (intérêt légitime). Elles ne sont ni vendues, ni utilisées à des fins publicitaires.
        </p>
      </LegalSection>
      <LegalSection title="Cookies et stockage local">
        <ul>
          <li>
            Un cookie de session, strictement nécessaire, vous garde connecté (environ un an, renouvelé à chaque visite).
          </li>
          <li>
            Le stockage du navigateur conserve vos préférences (langue, thème) et une copie hors ligne du
            catalogue.
          </li>
          <li>
            La mesure d’audience (Vercel Web Analytics et Speed Insights) fonctionne sans cookie et produit des
            statistiques agrégées et anonymes.
          </li>
        </ul>
        <p>Aucun cookie publicitaire ou de pistage n’est utilisé : aucun consentement n’est donc demandé.</p>
      </LegalSection>
      <LegalSection title="Destinataires et hébergement">
        <p>
          Les données sont hébergées par {SITE.host.name} (États-Unis), qui agit comme sous-traitant dans le cadre des
          clauses contractuelles types de la Commission européenne. Google ou Apple reçoivent votre demande de
          connexion si vous choisissez ces méthodes.
        </p>
      </LegalSection>
      <LegalSection title="Durée de conservation">
        <p>
          Les données de compte sont conservées tant que le compte existe. Les compteurs anti-abus liés à l’adresse IP
          sont purgés automatiquement après expiration.
        </p>
      </LegalSection>
      <LegalSection title="Vos droits">
        <p>
          Vous pouvez accéder à vos données, les rectifier, les exporter (export CSV de la collection) ou demander la
          suppression de votre compte et de toutes les données associées en écrivant via <LegalContact />. Vous pouvez
          aussi introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
