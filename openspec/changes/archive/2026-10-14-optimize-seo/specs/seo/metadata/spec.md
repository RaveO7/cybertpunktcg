# Spec Delta

## Purpose

Donner à chaque page un titre, une description, une URL canonique, un aperçu de partage et une règle d'indexation cohérents, afin que les moteurs de recherche et les réseaux sociaux présentent correctement le site sous la marque « TCG Tracker ».

## ADDED Requirements

### Requirement: Marque unique
Le site MUST se présenter sous le seul nom « TCG Tracker » dans les titres de page, le nom d'application, le nom du site Open Graph, le manifest d'application et les données structurées. Le nom « Collection Cyberpunk TCG » MUST NOT plus apparaître comme nom du site.

#### Scenario: Titre d'une page interne
- **WHEN** un robot charge la fiche publique de la boutique « Arasaka Games »
- **THEN** le titre de la page se termine par « · TCG Tracker »

#### Scenario: Application installée
- **WHEN** un utilisateur installe l'application sur son téléphone
- **THEN** le nom affiché est « TCG Tracker »

### Requirement: Titre et description propres à chaque page indexable
Chaque page indexable MUST avoir un titre unique de 70 caractères au plus et une description de 50 à 160 caractères, dans la langue de la page, contenant le sujet de la page et le terme « Cyberpunk TCG ». La page d'accueil MUST utiliser un titre complet sans le suffixe de marque répété.

#### Scenario: Fiche de carte
- **WHEN** un robot charge la fiche française de la carte « Adam Smasher: Ender of Legends »
- **THEN** le titre contient le nom de la carte et « Cyberpunk TCG », et la description résume son type, sa couleur et son coût

#### Scenario: Description trop longue
- **WHEN** la description d'une boutique fait 400 caractères
- **THEN** la description de la page est tronquée à 160 caractères au plus, sur une limite de mot

### Requirement: URL canonique absolue
Chaque page indexable MUST déclarer une URL canonique absolue construite sur le domaine de production configuré. L'URL canonique MUST exclure les paramètres de filtre, de tri, de vue et de pagination des annuaires et du catalogue.

#### Scenario: Annuaire filtré
- **WHEN** un robot charge `/tournois/publics?country=FR&period=week`
- **THEN** l'URL canonique déclarée est l'URL absolue de `/tournois/publics` sans paramètre

#### Scenario: Domaine de production
- **WHEN** le site est servi depuis une URL de prévisualisation
- **THEN** l'URL canonique pointe vers le domaine de production

### Requirement: Aperçu de partage
Chaque page indexable MUST fournir les métadonnées Open Graph (titre, description, URL, type, nom du site, langue, image) et Twitter Card (`summary_large_image`). Une image par défaut de 1200×630 aux couleurs du site MUST être utilisée quand la page n'a pas d'image propre.

#### Scenario: Partage de la page d'accueil
- **WHEN** un utilisateur colle l'URL de l'accueil dans une messagerie qui lit Open Graph
- **THEN** l'aperçu montre le titre, la description et l'image par défaut du site

### Requirement: Image de partage des fiches
Une fiche de carte MUST utiliser l'image de la carte comme image de partage avec son texte alternatif. Une fiche de tournoi public MUST utiliser une image générée montrant le nom du tournoi, la date, la ville et la boutique. Une fiche de boutique MUST utiliser une image générée montrant le nom, la ville et le logo s'il existe.

#### Scenario: Partage d'un tournoi
- **WHEN** un organisateur partage la fiche publique de son tournoi
- **THEN** l'aperçu montre une image avec le nom, la date et la ville du tournoi

#### Scenario: Boutique sans logo
- **WHEN** la fiche d'une boutique sans logo est partagée
- **THEN** l'image générée montre le nom et la ville sans emplacement de logo vide

### Requirement: Pages exclues de l'index
Les pages qui exigent une connexion, les pages d'administration et de gestion de compte, et les pages ouvertes par un lien à jeton (classeur partagé, page joueur d'un tournoi, invitation, réclamation de place) MUST être servies avec la directive `noindex, nofollow`. Elles MUST NOT apparaître dans le sitemap.

#### Scenario: Classeur partagé
- **WHEN** un robot suit un lien vers `/classeur/<jeton>`
- **THEN** la page porte `noindex, nofollow`

#### Scenario: Explorateur de l'application
- **WHEN** un robot charge `/cards`
- **THEN** la page porte `noindex` et pointe par un lien vers le catalogue public `/cartes`

### Requirement: Contenus retirés non indexés
Une fiche de tournoi public annulé MUST porter `noindex`. Une page introuvable MUST répondre avec le statut HTTP 404 et porter `noindex`.

#### Scenario: Tournoi annulé
- **WHEN** un robot charge la fiche d'un tournoi public qui a été annulé
- **THEN** la page s'affiche avec `noindex`

#### Scenario: Carte inconnue
- **WHEN** un robot charge `/cartes/carte-qui-n-existe-pas`
- **THEN** la réponse a le statut 404 et porte `noindex`
