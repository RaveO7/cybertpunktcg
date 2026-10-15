# seo/structured-data Specification

## Purpose
Décrire le contenu des pages publiques sous forme de données structurées schema.org (JSON-LD), pour que les moteurs de recherche affichent des résultats enrichis : événements, boutiques locales, fil d'Ariane et nom du site.

## Requirements

### Requirement: Format des données structurées
Les données structurées MUST être publiées en JSON-LD dans le HTML rendu par le serveur, dans la langue de la page, avec des URL absolues. Elles MUST décrire uniquement ce qui est visible sur la page, et le texte saisi par les utilisateurs MUST y être échappé pour ne pas pouvoir fermer la balise de script.

#### Scenario: Nom de tournoi piégé
- **WHEN** un tournoi public s'appelle `</script><script>alert(1)</script>`
- **THEN** la fiche affiche ce nom en texte et aucun script supplémentaire n'est exécuté

### Requirement: Site et organisation
La page d'accueil (dans chaque langue) MUST publier un objet `WebSite` (nom « TCG Tracker », URL, langue) et un objet `Organization` (nom, URL, logo, et liens vers les réseaux sociaux configurés non vides).

#### Scenario: Réseaux non configurés
- **WHEN** aucun lien de réseau social n'est renseigné
- **THEN** l'objet `Organization` ne contient pas de propriété `sameAs`

### Requirement: Fil d'Ariane
Chaque fiche (carte, tournoi public, boutique) et chaque annuaire MUST publier un `BreadcrumbList` reflétant sa position (accueil › section › page), et la page MUST afficher le même fil d'Ariane de manière visible.

#### Scenario: Fiche de carte
- **WHEN** un robot charge la fiche d'une carte
- **THEN** il trouve un fil d'Ariane Accueil › Cartes › nom de la carte, visible et en JSON-LD

### Requirement: Événement pour un tournoi public
Une fiche de tournoi public non annulée MUST publier un objet `Event` avec nom, date de début (avec fuseau horaire), statut de l'événement, mode de participation en présentiel, lieu (`Place` avec nom, adresse et coordonnées), organisateur (boutique ou organisateur affiché), description et offre (prix et devise, ou gratuit, disponibilité selon les places restantes et URL de la fiche).

#### Scenario: Tournoi complet
- **WHEN** un tournoi public n'a plus de place
- **THEN** l'offre de son `Event` indique une disponibilité « épuisé »

#### Scenario: Tournoi gratuit
- **WHEN** un tournoi public n'a pas de prix d'entrée
- **THEN** l'offre indique un prix de 0

### Requirement: Liste d'événements dans l'annuaire
L'annuaire des tournois publics et la fiche d'une boutique MUST publier un `ItemList` des tournois à venir affichés sur la page, chaque élément pointant vers l'URL de sa fiche.

#### Scenario: Annuaire vide
- **WHEN** aucun tournoi public n'est à venir
- **THEN** l'annuaire ne publie pas d'`ItemList`

### Requirement: Boutique locale
Une fiche de boutique MUST publier un objet `Store` avec nom, URL, adresse, coordonnées, logo, site web, téléphone, horaires d'ouverture (plages reconnues dans le texte saisi) et liens de réseaux sociaux lorsqu'ils sont renseignés. Une propriété vide MUST être omise.

#### Scenario: Boutique sans horaires
- **WHEN** une boutique n'a pas renseigné d'horaires
- **THEN** son objet `Store` ne contient pas de propriété d'horaires

#### Scenario: Horaires saisis librement
- **WHEN** une boutique indique « Mar–Sam 10h–19h »
- **THEN** son objet `Store` déclare une ouverture du mardi au samedi de 10:00 à 19:00

#### Scenario: Horaires non reconnus
- **WHEN** une boutique indique « Ouvert presque tout le temps »
- **THEN** son objet `Store` ne contient pas de propriété d'horaires

### Requirement: Carte de jeu
Une fiche de carte MUST publier un objet `CreativeWork` avec nom, image, description (texte de règles), langue, illustrateur s'il est connu, et appartenance au jeu Cyberpunk TCG. Le catalogue MUST publier un `ItemList` des fiches de carte qu'il affiche.

#### Scenario: Illustrateur inconnu
- **WHEN** aucune impression de la carte n'indique d'illustrateur
- **THEN** l'objet `CreativeWork` ne contient pas de propriété d'auteur
