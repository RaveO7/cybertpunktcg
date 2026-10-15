# Spec Delta

## MODIFIED Requirements

### Requirement: Contenu traduit de la fiche
La fiche française MUST utiliser le nom, le texte de règles et l'image de l'impression française quand elle existe, et l'anglais sinon. La fiche anglaise MUST utiliser le contenu anglais. Les fiches allemande, espagnole et italienne MUST utiliser le nom et l'image de l'impression anglaise, et le texte de règles traduit dans leur langue quand une traduction à jour existe, le texte anglais sinon ; dans ce cas la fiche MUST indiquer que le texte de la carte est en anglais.

#### Scenario: Carte sans impression française
- **WHEN** une carte n'a pas d'impression française
- **THEN** sa fiche française affiche le nom et le texte anglais, avec l'interface en français

#### Scenario: Fiche allemande traduite
- **WHEN** un visiteur ouvre `/de/karten/v-streetkid`
- **THEN** il voit le nom anglais « V: Streetkid », le texte de règles en allemand et l'interface en allemand

#### Scenario: Fiche espagnole sans traduction
- **WHEN** une carte n'a pas de traduction espagnole à jour de son texte de règles
- **THEN** sa fiche espagnole affiche le texte anglais avec une mention indiquant qu'il est en anglais

### Requirement: Catalogue public
Une page publique, consultable sans compte et rendue côté serveur, MUST lister toutes les cartes de jeu actives (hors produits scellés), regroupées par type, avec leur image, leur nom dans la langue de la page et un lien vers leur fiche. Le contenu de la liste MUST être présent dans le HTML initial, sans dépendre de JavaScript. La liste MUST être accessible depuis le pied de page de toutes les pages et depuis le fil d'Ariane de chaque fiche.

#### Scenario: Visiteur sans compte
- **WHEN** un visiteur non connecté ouvre `/cartes`
- **THEN** il voit toutes les cartes de jeu, regroupées par type, sans écran de connexion

#### Scenario: Produit scellé
- **WHEN** le catalogue est affiché
- **THEN** aucun booster, display ni deck scellé n'y figure

#### Scenario: Fil d'Ariane d'une fiche
- **WHEN** un visiteur est sur la fiche `/it/carte/v-streetkid`
- **THEN** le fil d'Ariane « Home › Carte › V: Streetkid » renvoie vers `/it/carte`

## REMOVED Requirements

### Requirement: Filtres du catalogue
**Reason**: La liste des cartes n'a plus qu'une URL par langue, sans paramètres de filtre, pour éviter des pages dupliquées dans les moteurs de recherche ; les cartes sont regroupées par type avec des ancres.
**Migration**: Le filtrage détaillé reste disponible dans l'explorateur de cartes de l'application (`/cards`).
