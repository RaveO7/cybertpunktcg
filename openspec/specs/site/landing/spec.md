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

### Requirement: Affichage immédiat du haut de l'accueil
Sur la page d'accueil des visiteurs, le sur-titre, le titre principal, l'accroche et les boutons du haut de page MUST être lisibles dès le premier affichage du HTML rendu par le serveur, sans attendre le JavaScript, et ne MUST jamais être masqués (opacité nulle, découpe totale) au départ. Leur animation d'entrée MAY les déplacer jusqu'à leur place, sans les rendre invisibles.

#### Scenario: JavaScript désactivé ou lent
- **WHEN** un visiteur ouvre l'accueil et que le JavaScript n'est pas encore exécuté (ou est désactivé)
- **THEN** le titre principal et l'accroche sont visibles et lisibles à leur place finale, au plus tard à la fin de leur animation d'entrée

#### Scenario: Premier affichage
- **WHEN** le navigateur peint la page pour la première fois
- **THEN** le titre principal fait partie de ce premier affichage, avec une opacité non nulle

### Requirement: Animations de l'accueil indépendantes du chargement du JavaScript
Les animations d'arrivée du haut de l'accueil (entrée des textes, donne de l'éventail de cartes et son glitch final) MUST démarrer au premier affichage, sans dépendre du JavaScript. L'arrivée du JavaScript MUST NOT modifier ce qui est affiché, et le contenu du HTML serveur MUST rester complet et en place, y compris sans JavaScript.

#### Scenario: Pas de code d'autres écrans
- **WHEN** un visiteur charge l'accueil
- **THEN** aucune bibliothèque propre à un autre écran (génération de QR code des tournois) n'est téléchargée

#### Scenario: Donne de l'éventail sans JavaScript
- **WHEN** un visiteur ouvre l'accueil avec le JavaScript désactivé
- **THEN** les cartes de l'éventail sont distribuées puis restent posées en éventail

#### Scenario: Arrivée du JavaScript pendant la donne
- **WHEN** le JavaScript de l'éventail s'exécute pendant la donne
- **THEN** la donne continue sans saut ni redémarrage, et le survol des cartes n'est actif qu'une fois la donne finie

#### Scenario: Interactions après chargement
- **WHEN** le JavaScript de la page est chargé
- **THEN** le survol et le clic sur une carte de l'éventail, le carrousel des modules, les onglets Tournois / Boutiques et les apparitions au défilement fonctionnent comme avant

### Requirement: Préférence « réduire les animations » sur l'accueil
Si le visiteur préfère réduire les animations, l'accueil MUST s'afficher sans animation d'entrée, sans donne (éventail ouvert d'emblée), sans glitch automatique et sans apparition au défilement.

#### Scenario: Mouvement réduit
- **WHEN** un visiteur avec `prefers-reduced-motion: reduce` ouvre l'accueil
- **THEN** tous les textes et l'éventail ouvert sont affichés immédiatement à leur place, sans mouvement
