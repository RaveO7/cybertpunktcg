# Spec Delta

## MODIFIED Requirements

### Requirement: Une URL par langue pour les pages publiques
Les pages publiques MUST exister dans chaque langue du site, chacune sous son code, français compris (`/fr`, `/en`, `/de`, `/es`, `/it`), avec des segments d'URL traduits. Correspondance : accueil `/fr` · `/en` · `/de` · `/es` · `/it` ; liste des cartes `/fr/cartes` · `/en/cards` · `/de/karten` · `/es/cartas` · `/it/carte` (et `/<segment>/<slug>` pour une fiche) ; tournoi `/fr/tournois/publics/<id>` · `/en/tournaments/<id>` · `/de/turniere/<id>` · `/es/torneos/<id>` · `/it/tornei/<id>` ; boutique `/fr/boutiques/<slug>` · `/en/shops/<slug>` · `/de/shops/<slug>` · `/es/tiendas/<slug>` · `/it/negozi/<slug>`. Une adresse sans préfixe de langue (`/`, `/cards/<slug>`, ancienne adresse française `/cartes/<slug>`…) MUST être redirigée de façon permanente (308) vers la même page en anglais, query conservée. Les paramètres de filtre MUST être conservés d'une langue à l'autre.

#### Scenario: Version anglaise d'une fiche de boutique
- **WHEN** un visiteur ouvre `/en/shops/arasaka-games`
- **THEN** il voit la même boutique que sur `/fr/boutiques/arasaka-games`, avec l'interface en anglais

#### Scenario: Annuaire filtré
- **WHEN** un visiteur passe en anglais depuis `/fr/tournois/publics?country=FR`
- **THEN** il arrive sur `/en/tournois/publics?country=FR`

#### Scenario: Version italienne d'une fiche de carte
- **WHEN** un visiteur ouvre `/it/carte/v-streetkid`
- **THEN** il voit la même carte que sur `/fr/cartes/v-streetkid`, avec l'interface en italien

#### Scenario: Chemin technique tapé à la main
- **WHEN** un visiteur ouvre une adresse qui sert la page sans ses segments traduits, par exemple `/de/cards/v-streetkid`
- **THEN** il est redirigé de façon permanente vers `/de/karten/v-streetkid`

#### Scenario: Lien sans langue
- **WHEN** un visiteur ou un robot ouvre `/cartes/v-streetkid?ref=a` ou `/cards/v-streetkid?ref=a`
- **THEN** il est redirigé de façon permanente (308) vers `/en/cards/v-streetkid?ref=a`

### Requirement: Langue imposée par l'URL
Sur toute page du site, publique ou de l'application, la langue de l'interface, du contenu rendu par le serveur et de l'attribut `lang` du document MUST être celle de l'URL, quelle que soit la préférence enregistrée. Le premier affichage reçu du serveur MUST déjà être dans cette langue. Les écrans de l'application MUST exister sous le préfixe de chaque langue (`/fr/decks`, `/de/decks`).

#### Scenario: Préférence anglaise sur une URL française
- **WHEN** un visiteur qui a choisi l'anglais ouvre `/fr/cartes`
- **THEN** la page est en français et le document porte `lang="fr"`

#### Scenario: Application connectée
- **WHEN** un utilisateur connecté qui a choisi l'italien ouvre `/fr/decks`
- **THEN** il arrive sur `/it/decks` et l'interface est en italien

#### Scenario: Application en italien
- **WHEN** un utilisateur connecté ouvre `/it/decks`
- **THEN** la page reçue du serveur est en italien et le document porte `lang="it"`

### Requirement: Balises hreflang
Chaque page publique MUST déclarer toutes ses versions linguistiques (`fr`, `en`, `de`, `es`, `it`) et une version `x-default` pointant vers la version anglaise, avec des URL absolues et réciproques. Une page disponible en une seule langue MUST NOT déclarer d'alternative. Le sitemap MUST déclarer les mêmes alternatives.

#### Scenario: Fiche de carte
- **WHEN** un robot charge `/en/cards/v-streetkid`
- **THEN** la page déclare `hreflang` vers `/fr/cartes/v-streetkid`, `/en/cards/v-streetkid`, `/de/karten/v-streetkid`, `/es/cartas/v-streetkid`, `/it/carte/v-streetkid`, et `x-default` vers `/en/cards/v-streetkid`

### Requirement: Sélecteur de langue des pages publiques
Les visiteurs sans compte MUST disposer sur toute page d'un sélecteur listant toutes les langues du site, qui mène à la même page dans la langue choisie (filtres conservés). Choisir une langue MUST aussi l'enregistrer comme préférence.

#### Scenario: Passage en anglais
- **WHEN** un visiteur clique « English » sur `/fr/comment-jouer`
- **THEN** il arrive sur `/en/comment-jouer` et l'application s'affichera ensuite en anglais

#### Scenario: Passage en italien
- **WHEN** un visiteur choisit « Italiano » sur `/fr/cartes/v-streetkid`
- **THEN** il arrive sur `/it/carte/v-streetkid` et l'application s'affichera ensuite en italien

#### Scenario: Pas de bandeau parasite
- **WHEN** un visiteur change de langue avec le sélecteur
- **THEN** aucune suggestion de langue n'apparaît pendant le changement de page

### Requirement: Langue des utilisateurs connectés
Un utilisateur connecté choisit sa langue dans ses paramètres. S'il ouvre une page, publique ou de l'application, dans une autre langue que celle choisie, il MUST être emmené sur la même page dans sa langue. Les visiteurs sans compte et les robots MUST NOT être redirigés.

#### Scenario: Utilisateur anglophone sur une URL française
- **WHEN** un utilisateur connecté qui a choisi l'anglais ouvre `/fr/cartes/v-streetkid`
- **THEN** il arrive sur `/en/cards/v-streetkid`

#### Scenario: Utilisateur germanophone sur une URL française
- **WHEN** un utilisateur connecté qui a choisi l'allemand ouvre `/fr/cartes/v-streetkid`
- **THEN** il arrive sur `/de/karten/v-streetkid`

#### Scenario: Changement de langue connecté
- **WHEN** un utilisateur connecté passe en espagnol dans ses paramètres puis ouvre `/fr/decks`
- **THEN** il arrive sur `/es/decks`

### Requirement: Liens internes dans la langue de la page
Sur toute page, les liens vers d'autres pages du site (pages publiques, écrans de l'application, pages légales) MUST pointer vers leur version dans la langue de la page.

#### Scenario: Lien vers une boutique depuis un tournoi anglais
- **WHEN** un visiteur clique sur la boutique depuis `/en/tournaments/<id>`
- **THEN** il arrive sur `/en/shops/<slug>`

#### Scenario: Lien vers les conditions d'utilisation depuis une page espagnole
- **WHEN** un visiteur clique « Condiciones de uso » dans le pied de page de `/es`
- **THEN** il arrive sur la version espagnole des conditions d'utilisation

## ADDED Requirements

### Requirement: Suggestion de la langue du visiteur
Quand un visiteur consulte une page dans une autre langue que la sienne (préférence enregistrée, sinon pays de connexion, sinon langue du navigateur parmi celles du site, sinon anglais), le site MUST lui proposer un lien vers la même page dans sa langue, sans le rediriger. Le visiteur MUST pouvoir fermer cette suggestion, qui ne réapparaît alors plus pour cette langue.

#### Scenario: Visiteur en Espagne
- **WHEN** un visiteur connecté depuis l'Espagne, sans préférence, ouvre `/fr/cartes`
- **THEN** la page s'affiche en français avec une suggestion « Versión en español » vers `/es/cartas`

#### Scenario: Robot d'exploration
- **WHEN** un robot charge une page publique française
- **THEN** il reçoit la page française avec un statut 200, sans redirection

## REMOVED Requirements

### Requirement: Suggestion de version anglaise
**Reason**: Le site propose désormais cinq langues ; la suggestion vise la langue du visiteur et non plus seulement l'anglais.
**Migration**: Remplacée par l'exigence « Suggestion de la langue du visiteur ».
