# locations/geocoding Specification

## Purpose
Transformer une adresse saisie par un organisateur ou une boutique en un lieu normalisé (pays, région, ville, coordonnées), pour que les tournois et boutiques puissent être filtrés par lieu et par distance.

## Requirements

### Requirement: Lieu normalisé
Tout lieu enregistré (tournoi ou boutique) MUST comporter un pays (code ISO à 2 lettres), une ville, des coordonnées (latitude, longitude) et une adresse lisible, et MAY comporter une région, un code postal et un nom de salle. Un lieu sans pays, ville ou coordonnées MUST être refusé.

#### Scenario: Lieu incomplet
- **WHEN** une requête enregistre un lieu sans coordonnées
- **THEN** l'enregistrement est refusé (400)

### Requirement: Saisie d'adresse en France
Quand le pays choisi est la France, la saisie d'adresse MUST proposer des suggestions dès 3 caractères ; choisir une suggestion MUST remplir le lieu normalisé (ville, code postal, région, coordonnées).

#### Scenario: Suggestion choisie
- **WHEN** un gérant tape « 12 rue de la Ré » en choisissant la France puis sélectionne « 12 Rue de la République, 69002 Lyon »
- **THEN** le lieu est rempli avec Lyon, 69002, Auvergne-Rhône-Alpes et les coordonnées de l'adresse

### Requirement: Saisie d'adresse hors France
Pour les autres pays, l'utilisateur MUST saisir rue, code postal et ville, puis demander la localisation ; le système MUST résoudre l'adresse en un seul appel et afficher le résultat sur une carte avant l'enregistrement. Sans résultat, il MUST demander de corriger l'adresse.

#### Scenario: Adresse belge
- **WHEN** un gérant saisit une adresse à Bruxelles et demande la localisation
- **THEN** le lieu est résolu et affiché sur la carte pour confirmation

#### Scenario: Adresse introuvable
- **WHEN** l'adresse saisie ne donne aucun résultat
- **THEN** un message demande de vérifier l'adresse et rien n'est enregistré

### Requirement: Recherche de ville pour l'annuaire
Pour chercher autour d'une ville, l'annuaire MUST proposer des suggestions de villes ; il MUST au minimum proposer les villes ayant des tournois publics ou des boutiques, et les communes françaises.

#### Scenario: Ville avec des tournois
- **WHEN** un joueur tape « Gen » et qu'un tournoi public a lieu à Genève
- **THEN** Genève est proposée

### Requirement: Usage raisonnable des services de géocodage
Les appels de géocodage MUST passer par le serveur de l'app, MUST être limités en débit par IP et globalement (au plus une requête par seconde vers le service mondial), et leurs résultats MUST être mis en cache. Si le service est indisponible, l'utilisateur MUST recevoir un message lui demandant de réessayer, sans perdre sa saisie.

#### Scenario: Requêtes en rafale
- **WHEN** une même IP envoie plus de 30 recherches d'adresse en une minute
- **THEN** les recherches suivantes sont refusées (429) jusqu'à la fin de la fenêtre

#### Scenario: Service indisponible
- **WHEN** le service de géocodage ne répond pas
- **THEN** l'utilisateur voit un message « réessayez » et son formulaire reste rempli

### Requirement: Calcul de distance
La distance entre un point de recherche et un lieu MUST être la distance orthodromique (à vol d'oiseau), arrondie au kilomètre près pour l'affichage (au dixième sous 10 km).

#### Scenario: Paris – Lyon
- **WHEN** la distance entre le centre de Paris et le centre de Lyon est calculée
- **THEN** elle vaut environ 392 km
