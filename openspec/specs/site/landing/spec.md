# site/landing Specification

## Purpose
Présenter le site aux visiteurs sans compte et aux moteurs de recherche par une page d'accueil publique riche en contenu, et ouvrir le tutoriel à tous, au lieu de leur montrer un écran de connexion.

## Requirements

### Requirement: Page d'accueil des visiteurs
Un visiteur sans session MUST voir sur l'accueil une page de présentation rendue côté serveur comportant un titre principal unique mentionnant Cyberpunk TCG, une présentation des fonctionnalités (catalogue, suivi de collection et de valeur, decks, tournois, boutiques, tutoriel), des liens vers le catalogue, l'annuaire des tournois, l'annuaire des boutiques et le tutoriel, et un appel à créer un compte.

#### Scenario: Robot d'exploration
- **WHEN** un robot sans cookie charge `/`
- **THEN** le HTML reçu contient le titre principal, les sections de fonctionnalités et les liens, sans texte « Chargement… » ni formulaire de connexion à la place du contenu

#### Scenario: Version anglaise
- **WHEN** un visiteur ouvre `/en`
- **THEN** il voit la même page de présentation en anglais

### Requirement: Accueil des utilisateurs connectés
Un utilisateur connecté MUST continuer de voir son tableau de bord sur `/`. Sur `/en`, il MUST voir la page de présentation avec un lien vers l'application.

#### Scenario: Utilisateur connecté
- **WHEN** un utilisateur connecté ouvre `/`
- **THEN** il voit son tableau de bord comme aujourd'hui

### Requirement: Contenus dynamiques de l'accueil
La page de présentation MUST afficher le nombre de cartes du catalogue et au plus 3 tournois publics à venir avec un lien vers leur fiche. Sans tournoi à venir, ce bloc MUST être remplacé par un lien vers l'annuaire.

#### Scenario: Aucun tournoi à venir
- **WHEN** aucun tournoi public n'est à venir
- **THEN** l'accueil montre un lien vers l'annuaire des tournois au lieu de la liste

### Requirement: Accès et inscription depuis l'accueil
La page de présentation MUST proposer la connexion et la création de compte. Après connexion ou inscription depuis l'accueil, l'utilisateur MUST arriver sur son tableau de bord.

#### Scenario: Inscription
- **WHEN** un visiteur crée un compte depuis l'accueil
- **THEN** il arrive sur son tableau de bord

### Requirement: Arrivée après connexion
Après une connexion ou une inscription depuis n'importe quel écran de connexion (sauf un lien qui précise une page de retour), l'utilisateur MUST arriver sur son tableau de bord.

#### Scenario: Connexion depuis les paramètres après déconnexion
- **WHEN** un utilisateur se déconnecte depuis les paramètres puis se reconnecte sur l'écran de connexion affiché
- **THEN** il arrive sur son tableau de bord

#### Scenario: Page de retour explicite
- **WHEN** un visiteur s'inscrit depuis « Ajouter à ma collection » d'une fiche de carte
- **THEN** il arrive sur cette carte dans l'explorateur

### Requirement: Tutoriel public
Le tutoriel « Comment jouer » MUST être consultable sans compte, en français sur `/comment-jouer` et en anglais sur `/en/how-to-play`, avec son texte principal présent dans le HTML rendu par le serveur.

#### Scenario: Visiteur sans compte
- **WHEN** un visiteur non connecté ouvre `/comment-jouer`
- **THEN** il voit le tutoriel et non l'écran de connexion
