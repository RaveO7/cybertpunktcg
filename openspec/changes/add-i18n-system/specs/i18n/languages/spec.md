# Spec Delta

## Purpose

Définir les langues du site, la langue par défaut, la façon dont la langue d'un utilisateur est choisie et mémorisée, et garantir qu'une nouvelle langue peut être ajoutée sans créer de pages.

## ADDED Requirements

### Requirement: Langues prises en charge
Le site MUST être disponible en français, anglais, allemand, espagnol et italien. Le français MUST être la langue par défaut et la langue de référence des textes. Chaque langue MUST avoir un nom affiché dans sa propre langue (« Français », « English », « Deutsch », « Español », « Italiano »).

#### Scenario: Liste des langues
- **WHEN** un visiteur ouvre le sélecteur de langue
- **THEN** il voit les cinq langues, chacune écrite dans sa propre langue

#### Scenario: Langue inconnue dans l'URL
- **WHEN** un visiteur ouvre une URL préfixée par un code de langue non pris en charge, par exemple `/nl/cards`
- **THEN** il reçoit une page 404

### Requirement: Ajout d'une langue
Ajouter une langue MUST se limiter à déclarer la langue dans un registre unique et à fournir ses traductions et ses segments d'URL traduits : aucune page ni route MUST être créée ou recopiée. Une fois déclarée, la langue MUST apparaître dans le sélecteur, le sitemap, les balises `hreflang` et les images de partage.

#### Scenario: Nouvelle langue déclarée
- **WHEN** une sixième langue est déclarée avec ses traductions
- **THEN** toutes les pages publiques et de l'application existent dans cette langue, sans nouveau fichier de page

### Requirement: Repli quand une traduction manque
Si un texte n'est pas traduit dans une langue, le site MUST afficher sa version anglaise, et à défaut sa version française, au lieu d'une clé technique ou d'une erreur. Le manque MUST être signalé en développement et par les tests.

#### Scenario: Texte manquant en italien
- **WHEN** un bloc de texte nouvellement ajouté n'a pas encore de traduction italienne
- **THEN** la page italienne affiche le texte anglais et le test de cohérence des traductions échoue

### Requirement: Mémorisation du choix de langue
Choisir une langue dans le sélecteur ou dans les paramètres MUST l'enregistrer comme préférence de l'utilisateur, lisible par le serveur, et l'emmener sur la même page dans cette langue. Une préférence enregistrée par une version précédente du site MUST être reprise.

#### Scenario: Choix de l'espagnol
- **WHEN** un utilisateur choisit « Español » sur `/parametres`
- **THEN** il arrive sur `/es/parametres` et ses prochaines visites de l'application s'ouvrent en espagnol

#### Scenario: Ancienne préférence
- **WHEN** un utilisateur qui avait choisi l'italien avant la mise à jour ouvre l'application
- **THEN** l'application s'affiche en italien sans qu'il ait à choisir de nouveau

### Requirement: Langue de la dernière page publique
Un visiteur sans préférence enregistrée qui passe d'une page publique à un écran sans contenu public (connexion, inscription) MUST voir cet écran dans la langue de la page d'où il vient.

#### Scenario: Inscription depuis l'accueil allemand
- **WHEN** un visiteur sans préférence clique « Kostenloses Konto erstellen » sur `/de`
- **THEN** l'écran d'inscription s'affiche en allemand
