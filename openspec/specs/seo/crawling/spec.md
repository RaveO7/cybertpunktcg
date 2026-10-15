# seo/crawling Specification

## Purpose
Indiquer aux robots d'exploration ce qu'ils peuvent parcourir et leur fournir la liste à jour des pages publiques, pour que les nouvelles cartes, boutiques et tournois soient découverts rapidement.

## Requirements

### Requirement: Fichier robots.txt
Le site MUST servir `/robots.txt` autorisant l'exploration de tout le site sauf `/api/` et `/admin`, et déclarant l'URL absolue du sitemap. Les pages à jeton MUST NOT y être bloquées, afin que les robots puissent lire leur directive `noindex`.

#### Scenario: Lecture de robots.txt
- **WHEN** un robot demande `/robots.txt`
- **THEN** il reçoit une règle qui interdit `/api/` et `/admin` et une ligne `Sitemap:` avec l'URL absolue du sitemap

#### Scenario: Environnement de prévisualisation
- **WHEN** un robot demande `/robots.txt` sur un déploiement qui n'est pas la production
- **THEN** il reçoit une règle qui interdit tout le site

### Requirement: Sitemap des pages publiques
Le site MUST servir `/sitemap.xml` listant, avec des URL absolues : l'accueil, le catalogue, le tutoriel, l'annuaire des tournois, l'annuaire des boutiques, les pages légales, chaque fiche de carte, chaque boutique non refusée et chaque tournoi public non annulé dont la date de début date de moins de 180 jours ou est à venir.

#### Scenario: Nouvelle boutique
- **WHEN** une boutique en attente de vérification est créée
- **THEN** sa fiche apparaît dans le sitemap au plus tard une heure après

#### Scenario: Boutique refusée
- **WHEN** une boutique est refusée par un administrateur
- **THEN** sa fiche n'apparaît plus dans le sitemap

#### Scenario: Tournoi privé
- **WHEN** un tournoi est privé
- **THEN** il n'apparaît pas dans le sitemap

### Requirement: Versions linguistiques dans le sitemap
Chaque entrée du sitemap qui existe en français et en anglais MUST déclarer ses deux versions comme alternatives de langue. Les pages qui n'existent qu'en français (pages légales) MUST être listées sans alternative.

#### Scenario: Fiche de carte
- **WHEN** le sitemap liste la fiche française d'une carte
- **THEN** l'entrée déclare l'URL anglaise correspondante comme alternative `en` et l'URL française comme alternative `fr`

### Requirement: Date de dernière modification
Chaque fiche de carte, de boutique et de tournoi du sitemap MUST indiquer la date de dernière modification de son contenu. Les pages sans date connue MUST NOT indiquer une date fictive.

#### Scenario: Tournoi modifié
- **WHEN** l'organisateur modifie la description d'un tournoi public
- **THEN** la date de dernière modification de sa fiche dans le sitemap est mise à jour
