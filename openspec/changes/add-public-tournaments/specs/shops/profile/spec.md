## Purpose

Donner à chaque boutique de jeu une vitrine dans l'app (identité, adresse, contact, tournois), afin que les joueurs la découvrent à travers les tournois qu'elle organise.

## ADDED Requirements

### Requirement: Création d'un profil boutique
Un utilisateur connecté MUST pouvoir créer un profil boutique avec un nom (2 à 80 caractères) et une adresse résolue (pays, ville, coordonnées) obligatoires, et facultativement une description (2000 caractères maximum), un logo, un site web, des liens de réseaux sociaux, un téléphone, un e-mail de contact et des horaires d'ouverture. Un utilisateur MUST NOT gérer plus de 5 boutiques. Une nouvelle boutique MUST être « en attente de vérification ».

#### Scenario: Création
- **WHEN** un utilisateur crée la boutique « Arasaka Games » avec une adresse à Lyon
- **THEN** la boutique est créée, en attente de vérification, et il en est le gérant

#### Scenario: Adresse non résolue
- **WHEN** un utilisateur crée une boutique dont l'adresse n'a pas pu être localisée
- **THEN** la création est refusée avec un message demandant de préciser l'adresse

### Requirement: Adresse web de la boutique
Chaque boutique MUST avoir une adresse de page unique dérivée de son nom (minuscules, sans accents, tirets), complétée si besoin pour rester unique. Le gérant MUST pouvoir la modifier ; une adresse déjà prise ou réservée MUST être refusée.

#### Scenario: Nom déjà pris
- **WHEN** une seconde boutique s'appelle aussi « Arasaka Games »
- **THEN** son adresse de page est différente de celle de la première

### Requirement: Logo
Le gérant MUST pouvoir téléverser un logo PNG, JPEG ou WebP de 2 Mo au plus ; il MUST être recadré en carré et réduit avant stockage. Tout autre format ou taille MUST être refusé.

#### Scenario: Fichier trop lourd
- **WHEN** le gérant téléverse un logo de 5 Mo
- **THEN** le téléversement est refusé avec la limite indiquée

### Requirement: Liens externes sûrs
Le site web et les liens de réseaux sociaux MUST être des URL `https` (ou `http`) valides ; ils MUST s'ouvrir dans un nouvel onglet et MUST être marqués comme non suivis par les moteurs de recherche.

#### Scenario: Lien invalide
- **WHEN** le gérant saisit `javascript:alert(1)` comme site web
- **THEN** l'enregistrement est refusé

### Requirement: Modification par le gérant
Seul le gérant d'une boutique (ou un administrateur) MUST pouvoir la modifier. Modifier le nom ou l'adresse d'une boutique vérifiée MUST la repasser en attente de vérification.

#### Scenario: Autre utilisateur
- **WHEN** un utilisateur tente de modifier une boutique qu'il ne gère pas
- **THEN** la demande est refusée (403)

#### Scenario: Déménagement
- **WHEN** le gérant d'une boutique vérifiée change son adresse
- **THEN** la boutique repasse en attente de vérification et perd son badge jusqu'à la nouvelle validation

### Requirement: Page publique de la boutique
Toute boutique non refusée MUST avoir une page consultable sans compte, montrant ses informations, son badge si elle est vérifiée, une carte de son adresse, ses prochains tournois publics et les résultats de ses 10 derniers tournois publics terminés. Les tournois privés MUST NOT y figurer. La page d'une boutique refusée MUST répondre « introuvable ».

#### Scenario: Page d'une boutique vérifiée
- **WHEN** un visiteur ouvre la page d'une boutique vérifiée qui a 2 tournois publics à venir et 1 privé
- **THEN** il voit le badge, l'adresse, la carte et les 2 tournois publics seulement

### Requirement: Annuaire des boutiques
Une page publique MUST lister les boutiques non refusées, filtrables par pays, ville et rayon comme l'annuaire des tournois, avec une vue carte ; les boutiques vérifiées MUST être listées en premier.

#### Scenario: Boutiques proches
- **WHEN** un joueur cherche les boutiques à 10 km de Bordeaux
- **THEN** il voit les boutiques situées dans ce rayon, vérifiées d'abord

### Requirement: Suppression d'une boutique
Le gérant MUST pouvoir supprimer sa boutique. Ses tournois MUST être conservés et simplement détachés de la boutique ; la suppression du compte du gérant MUST supprimer ses boutiques de la même façon.

#### Scenario: Boutique fermée
- **WHEN** un gérant supprime sa boutique qui avait 5 tournois terminés
- **THEN** les 5 tournois et leurs résultats existent toujours, sans boutique rattachée
