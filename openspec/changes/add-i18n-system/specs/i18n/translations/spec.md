# Spec Delta

## Purpose

Organiser tous les textes du site en blocs traduits dans chaque langue, faciles à ajouter, modifier ou supprimer, et garantir que tout le site, y compris les règles, les pages légales et le texte des cartes, est réellement affiché dans la langue choisie.

## ADDED Requirements

### Requirement: Textes organisés en blocs par langue
Chaque texte affiché par le site MUST provenir d'un bloc de traductions nommé (par exemple navigation, accueil, catalogue, tournois, paramètres, règles, pages légales), présent une fois par langue. Ajouter, modifier ou supprimer un texte MUST se faire dans ces blocs, sans modifier le code des composants qui l'affichent.

#### Scenario: Modifier un texte
- **WHEN** le titre de l'accueil espagnol est modifié dans le bloc de l'accueil espagnol
- **THEN** la page `/es` affiche le nouveau titre, et aucune autre langue n'est modifiée

#### Scenario: Ajouter un bloc
- **WHEN** un nouveau bloc de textes est ajouté pour une nouvelle section de l'interface
- **THEN** il est créé une fois par langue, et le test de cohérence signale chaque langue où il manque

### Requirement: Cohérence des clés entre les langues
Chaque langue MUST contenir exactement les mêmes blocs et les mêmes clés que la langue de référence (français). Un test automatique MUST échouer en cas de clé manquante, de clé en trop, ou de variable différente entre une traduction et la référence.

#### Scenario: Clé supprimée en français seulement
- **WHEN** une clé est supprimée du bloc français mais reste dans le bloc allemand
- **THEN** le test de cohérence échoue en nommant la clé et la langue

#### Scenario: Variable oubliée
- **WHEN** la traduction italienne de « {count} cartes » ne contient pas `{count}`
- **THEN** le test de cohérence échoue

### Requirement: Variables, pluriels et formats régionaux
Les textes MUST pouvoir contenir des variables et des formes plurielles propres à chaque langue. Les dates, heures, prix et nombres MUST être affichés au format régional de la langue de la page.

#### Scenario: Pluriel
- **WHEN** une liste contient 1 carte puis 3 cartes sur la page allemande
- **THEN** le texte affiche « 1 Karte » puis « 3 Karten »

#### Scenario: Prix
- **WHEN** un prix de 12,5 € est affiché sur la page anglaise puis sur la page allemande
- **THEN** il apparaît « €12.50 » puis « 12,50 € »

### Requirement: Couverture complète de l'interface
L'application, les pages publiques, les messages d'erreur, les pages 404 et d'erreur, et les textes d'accessibilité (libellés de boutons, textes alternatifs) MUST être affichés dans la langue de la page. Aucun texte d'interface MUST rester fixé dans une seule langue dans le code.

#### Scenario: Erreur en italien
- **WHEN** une action échoue sur une page italienne
- **THEN** le message d'erreur est en italien

### Requirement: Règles et tutoriel traduits
Les règles du jeu, le parcours « Apprendre à jouer », la partie guidée, l'anatomie d'une carte et les cartes d'exemple MUST être disponibles dans les cinq langues. Les mots-clés de jeu entre accolades (`{Call}`, `{Go Solo}`…) et les affiliations en majuscules (`ARASAKA`, `BRAINDANCE`…) MUST rester tels qu'imprimés sur les cartes.

#### Scenario: Tutoriel en espagnol
- **WHEN** un utilisateur ouvre le parcours « Apprendre à jouer » en espagnol
- **THEN** toutes les étapes, consignes et explications sont en espagnol, et `{Go Solo}` reste écrit tel quel

### Requirement: Pages légales traduites
Les mentions légales, les conditions d'utilisation et la politique de confidentialité MUST exister dans les cinq langues, chacune à une URL propre à sa langue. Chaque version non française MUST indiquer que la version française fait foi et y renvoyer.

#### Scenario: Conditions d'utilisation en allemand
- **WHEN** un visiteur ouvre la version allemande des conditions d'utilisation
- **THEN** il lit le texte en allemand, avec une mention et un lien vers la version française qui fait foi

### Requirement: Texte de règles des cartes traduit
Le texte de règles de chaque carte MUST être affiché dans la langue de la page quand une traduction existe : impression officielle pour le français, traduction du site pour l'allemand, l'espagnol et l'italien. Le nom de la carte MUST rester celui de l'impression (anglaise faute d'impression dans la langue).

#### Scenario: Fiche italienne
- **WHEN** un visiteur ouvre une fiche de carte en italien
- **THEN** le nom de la carte est en anglais et son texte de règles en italien

### Requirement: Traduction de texte de carte périmée
Une traduction du site du texte de règles d'une carte MUST être liée au texte anglais qu'elle traduit. Si le texte anglais de la carte change, la page MUST afficher le texte anglais à jour au lieu de l'ancienne traduction, et la traduction périmée MUST être signalée par un test ou une vérification.

#### Scenario: Errata d'une carte
- **WHEN** le texte anglais d'une carte est corrigé dans la base après sa traduction allemande
- **THEN** la fiche allemande affiche le nouveau texte anglais et la traduction allemande est signalée comme à refaire
