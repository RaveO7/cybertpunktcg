# Spec Delta

## Purpose

Rendre les pages publiques indexables en français et en anglais grâce à une URL par langue, pour que chaque moteur de recherche présente la bonne version selon la langue de l'internaute.

## ADDED Requirements

### Requirement: Une URL par langue pour les pages publiques
Les pages publiques MUST exister en français sans préfixe et en anglais sous `/en` selon cette correspondance : `/` ↔ `/en`, `/cartes` ↔ `/en/cards`, `/cartes/<slug>` ↔ `/en/cards/<slug>`, `/comment-jouer` ↔ `/en/how-to-play`, `/tournois/publics` ↔ `/en/tournaments`, `/tournois/publics/<id>` ↔ `/en/tournaments/<id>`, `/boutiques` ↔ `/en/shops`, `/boutiques/<slug>` ↔ `/en/shops/<slug>`. Les paramètres de filtre MUST être conservés entre les deux versions.

#### Scenario: Version anglaise d'une fiche de boutique
- **WHEN** un visiteur ouvre `/en/shops/arasaka-games`
- **THEN** il voit la même boutique que sur `/boutiques/arasaka-games`, avec l'interface en anglais

#### Scenario: Annuaire filtré
- **WHEN** un visiteur passe en anglais depuis `/tournois/publics?country=FR`
- **THEN** il arrive sur `/en/tournaments?country=FR`

### Requirement: Langue imposée par l'URL
Sur les pages publiques localisées, la langue de l'interface, du contenu rendu par le serveur et de l'attribut `lang` du document MUST être celle de l'URL, quelle que soit la langue enregistrée dans le navigateur. Les pages de l'application connectée MUST continuer d'utiliser la langue choisie dans les paramètres.

#### Scenario: Préférence anglaise sur une URL française
- **WHEN** un visiteur qui a choisi l'anglais ouvre `/cartes`
- **THEN** la page est en français et le document porte `lang="fr"`

#### Scenario: Application connectée
- **WHEN** un utilisateur connecté qui a choisi l'italien ouvre `/decks`
- **THEN** l'interface est en italien comme aujourd'hui

### Requirement: Balises hreflang
Chaque page publique disponible dans les deux langues MUST déclarer ses versions `fr` et `en` et une version `x-default` pointant vers la version française, avec des URL absolues et réciproques. Une page disponible en une seule langue MUST NOT déclarer d'alternative.

#### Scenario: Fiche de carte
- **WHEN** un robot charge `/en/cards/v-streetkid`
- **THEN** la page déclare `hreflang="en"` vers elle-même, `hreflang="fr"` vers `/cartes/v-streetkid` et `x-default` vers `/cartes/v-streetkid`

### Requirement: Sélecteur de langue des pages publiques
Les pages publiques localisées MUST proposer un lien vers la version de l'autre langue de la même page. Choisir une langue MUST aussi l'enregistrer comme préférence du navigateur.

#### Scenario: Passage en anglais
- **WHEN** un visiteur clique « English » sur `/comment-jouer`
- **THEN** il arrive sur `/en/how-to-play` et l'application connectée s'affichera ensuite en anglais

### Requirement: Suggestion de version anglaise
Quand la langue enregistrée ou celle du navigateur d'un visiteur n'est pas le français et qu'il consulte une page publique française, le site MUST lui proposer un lien vers la version anglaise sans le rediriger automatiquement. Le visiteur MUST pouvoir fermer cette suggestion, qui ne réapparaît alors plus.

#### Scenario: Visiteur germanophone
- **WHEN** un visiteur dont le navigateur est en allemand ouvre `/tournois/publics`
- **THEN** la page s'affiche en français avec une suggestion « English version »

#### Scenario: Robot d'exploration
- **WHEN** un robot charge une page publique française
- **THEN** il reçoit la page française avec un statut 200, sans redirection

### Requirement: Liens internes dans la langue de la page
Sur une page publique localisée, les liens vers d'autres pages publiques MUST pointer vers leur version dans la même langue. Les liens vers l'application connectée et vers les pages légales MUST pointer vers leur URL unique.

#### Scenario: Lien vers une boutique depuis un tournoi anglais
- **WHEN** un visiteur clique sur la boutique depuis `/en/tournaments/<id>`
- **THEN** il arrive sur `/en/shops/<slug>`
