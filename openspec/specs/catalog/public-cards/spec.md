# catalog/public-cards Specification

## Purpose
Rendre le catalogue des cartes Cyberpunk TCG consultable sans compte, avec une page par carte, pour que les joueurs qui cherchent une carte trouvent le site et découvrent la gestion de collection.

## Requirements

### Requirement: Catalogue public
Une page publique, consultable sans compte et rendue côté serveur, MUST lister toutes les cartes de jeu actives (hors produits scellés) avec leur image, leur nom dans la langue de la page et un lien vers leur fiche. Le contenu de la liste MUST être présent dans le HTML initial, sans dépendre de JavaScript.

#### Scenario: Visiteur sans compte
- **WHEN** un visiteur non connecté ouvre `/cartes`
- **THEN** il voit toutes les cartes de jeu, sans écran de connexion

#### Scenario: Produit scellé
- **WHEN** le catalogue est affiché
- **THEN** aucun booster, display ni deck scellé n'y figure

### Requirement: Filtres du catalogue
Le catalogue MUST permettre de filtrer par couleur et par type de carte. Les filtres MUST être reflétés dans l'URL et MUST être utilisables avec des liens ordinaires.

#### Scenario: Filtre par couleur
- **WHEN** un visiteur choisit la couleur rouge
- **THEN** seules les cartes rouges sont listées et l'URL contient le filtre

### Requirement: Fiche publique d'une carte
Chaque carte de jeu active MUST avoir une fiche publique à une adresse stable dérivée de son identifiant de carte, montrant : nom, image, type, couleur, coût, puissance, RAM, texte de règles, mots-clés, impressions (extension, numéro, rareté, illustrateur) et prix de marché indicatif le plus récent avec sa date.

#### Scenario: Fiche française
- **WHEN** un visiteur ouvre `/cartes/v-streetkid`
- **THEN** il voit la carte « V: Streetkid » avec ses caractéristiques et ses impressions

#### Scenario: Carte sans prix
- **WHEN** aucune impression d'une carte n'a de prix de marché
- **THEN** la fiche n'affiche pas de bloc de prix

### Requirement: Contenu traduit de la fiche
La fiche française MUST utiliser le nom, le texte de règles et l'image de l'impression française quand elle existe, et l'anglais sinon. La fiche anglaise MUST utiliser le contenu anglais.

#### Scenario: Carte sans impression française
- **WHEN** une carte n'a pas d'impression française
- **THEN** sa fiche française affiche le nom et le texte anglais, avec l'interface en français

### Requirement: Liens entre les fiches
Chaque fiche de carte MUST proposer des liens vers les cartes précédente et suivante dans l'ordre du catalogue et vers au plus 6 autres cartes de la même couleur.

#### Scenario: Navigation
- **WHEN** un visiteur est sur la fiche d'une carte rouge
- **THEN** il voit des liens vers d'autres cartes rouges

### Requirement: Passage à l'application
Le catalogue et chaque fiche MUST proposer une action pour suivre la carte dans sa collection. Pour un visiteur non connecté, elle MUST mener à la création de compte ; pour un utilisateur connecté, elle MUST ouvrir la carte dans l'explorateur de l'application.

#### Scenario: Utilisateur connecté
- **WHEN** un utilisateur connecté clique « Ajouter à ma collection » sur une fiche
- **THEN** l'explorateur de cartes s'ouvre sur cette carte

### Requirement: Fraîcheur du catalogue public
Les pages du catalogue public MUST refléter un ajout de carte ou une mise à jour des prix au plus tard une heure après l'import, sans nouveau déploiement.

#### Scenario: Import de prix
- **WHEN** l'import quotidien des prix se termine
- **THEN** les fiches affichent les nouveaux prix dans l'heure
