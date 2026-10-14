import type { Metadata } from "next";
import { LegalContact, LegalPage, LegalSection } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
};

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="Éditeur">
        <p>
          {SITE.name} est un site de fans édité à titre personnel et non commercial par {SITE.publisher}. Contact :{" "}
          <LegalContact />.
        </p>
      </LegalSection>
      <LegalSection title="Hébergement">
        <p>
          {SITE.host.name}, {SITE.host.address} — <a href={SITE.host.url}>{SITE.host.url.replace("https://", "")}</a>.
        </p>
      </LegalSection>
      <LegalSection title="Propriété intellectuelle">
        <p>
          Cyberpunk, Cyberpunk 2077, les noms, illustrations et visuels des cartes ainsi que les logos associés sont la
          propriété de CD PROJEKT S.A. et de leurs ayants droit respectifs. Ils sont reproduits ici à des fins
          d’information et de référence pour les joueurs.
        </p>
        <p>
          Ce site n’est ni affilié, ni sponsorisé, ni approuvé par CD PROJEKT RED ni par l’éditeur du jeu de cartes
          Cyberpunk TCG. Tout ayant droit souhaitant le retrait d’un contenu peut écrire via <LegalContact /> : la
          demande sera traitée rapidement.
        </p>
      </LegalSection>
      <LegalSection title="Prix">
        <p>
          Les prix affichés proviennent du guide de prix public de Cardmarket. Ils sont donnés à titre indicatif, sans
          garantie d’exactitude ni d’actualité, et ne constituent pas un conseil d’investissement.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
