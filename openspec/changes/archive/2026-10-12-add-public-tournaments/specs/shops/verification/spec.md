## Purpose

Garantir aux joueurs qu'une boutique affichée comme vérifiée existe réellement, grâce à une validation manuelle par un administrateur de l'app.

## ADDED Requirements

### Requirement: Rôle administrateur
Un compte MUST avoir le rôle `utilisateur` (par défaut) ou `administrateur`. Le rôle administrateur MUST être attribué ou retiré uniquement par une commande d'exploitation côté serveur, jamais depuis l'interface ni l'API. Toute route d'administration MUST refuser (403) un compte non administrateur.

#### Scenario: Utilisateur ordinaire
- **WHEN** un utilisateur sans rôle administrateur appelle l'API de validation des boutiques
- **THEN** la demande est refusée (403)

#### Scenario: Nouveau compte
- **WHEN** un compte est créé
- **THEN** son rôle est `utilisateur`

### Requirement: États de vérification
Une boutique MUST être dans l'un des états `en attente`, `vérifiée` ou `refusée`. Seule une boutique vérifiée MUST porter le badge « Boutique vérifiée » et bénéficier de la mise en avant dans les annuaires.

#### Scenario: Boutique en attente
- **WHEN** une boutique en attente publie un tournoi public
- **THEN** le tournoi apparaît dans l'annuaire, sans badge ni mise en avant

### Requirement: File de validation
Les administrateurs MUST disposer d'une page listant les boutiques en attente, de la plus ancienne demande à la plus récente, avec toutes les informations du profil et le compte du gérant. Ils MUST pouvoir consulter aussi les boutiques vérifiées et refusées.

#### Scenario: Nouvelle demande
- **WHEN** un gérant crée une boutique
- **THEN** elle apparaît en fin de file de validation des administrateurs

### Requirement: Validation et refus
Un administrateur MUST pouvoir valider une boutique en attente, ou la refuser avec un motif obligatoire (500 caractères maximum). Il MUST aussi pouvoir retirer la vérification d'une boutique vérifiée (motif obligatoire), ce qui la repasse en `refusée`. La date et l'administrateur de la décision MUST être enregistrés.

#### Scenario: Validation
- **WHEN** un administrateur valide la boutique « Arasaka Games »
- **THEN** la boutique est vérifiée et sa page affiche le badge

#### Scenario: Refus sans motif
- **WHEN** un administrateur refuse une boutique sans saisir de motif
- **THEN** le refus est rejeté avec un message demandant le motif

### Requirement: Information du gérant
Le gérant MUST voir l'état de vérification de sa boutique et, si elle est refusée, le motif. Il MUST pouvoir modifier sa boutique refusée et la soumettre de nouveau, ce qui la repasse en attente.

#### Scenario: Nouvelle soumission
- **WHEN** le gérant d'une boutique refusée corrige son adresse et la soumet de nouveau
- **THEN** la boutique repasse en attente et retourne dans la file de validation

### Requirement: Effets d'un refus
Une boutique refusée MUST NOT apparaître dans l'annuaire des boutiques, sa page MUST répondre « introuvable », et elle MUST NOT pouvoir être rattachée à un nouveau tournoi. Les tournois publics qui y sont déjà rattachés MUST rester listés, mais sans afficher la boutique.

#### Scenario: Tournoi d'une boutique refusée
- **WHEN** un joueur consulte un tournoi public rattaché à une boutique refusée
- **THEN** la fiche affiche l'organisateur mais ni le nom ni le lien de la boutique
