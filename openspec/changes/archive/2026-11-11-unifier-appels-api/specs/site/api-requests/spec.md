# Spec Delta

## Purpose

Fixe le comportement commun de tous les échanges entre l'application (navigateur ou application installée) et le serveur : absence de réseau, session expirée, erreurs renvoyées par le serveur, réponses au format inattendu et regroupement des lectures identiques, pour que chaque écran réagisse de la même façon.

## ADDED Requirements

### Requirement: Absence de réseau
Quand une requête vers le serveur ne peut pas partir faute de réseau, l'écran MUST afficher le message « hors ligne » traduit de son contexte, et non un message technique (« Failed to fetch », « TypeError »…). Les modifications de collection hors ligne MUST continuer à suivre `collection/offline-sync`.

#### Scenario: Action sans réseau
- **WHEN** l'utilisateur crée un tournoi alors que l'appareil n'a pas de réseau
- **THEN** l'écran affiche le message « hors ligne » dans la langue de l'interface

#### Scenario: Modification de collection sans réseau
- **WHEN** l'utilisateur ajoute une carte à sa collection hors ligne
- **THEN** la modification est mise en file d'attente comme avant, sans message d'erreur

### Requirement: Session expirée
Quand le serveur répond qu'aucune session n'est valide (401) à une action d'un utilisateur connecté, l'écran MUST afficher le message traduit « session expirée », sur tous les écrans de la même façon.

#### Scenario: Session expirée pendant une modification
- **WHEN** la session a expiré et que l'utilisateur renomme un deck
- **THEN** l'écran affiche « session expirée » et non un message générique

### Requirement: Erreur renvoyée par le serveur
Quand le serveur refuse une requête avec un message d'erreur, l'écran MUST afficher ce message (déjà traduit par le serveur dans la langue de la requête). Sans message exploitable, l'écran MUST afficher un message d'échec générique traduit. Les détails d'erreur renvoyés par le serveur (champs invalides, valeurs) MUST rester disponibles pour l'écran qui les exploite.

#### Scenario: Refus avec message
- **WHEN** le serveur refuse l'inscription à un tournoi complet avec un message
- **THEN** l'écran affiche ce message tel quel

#### Scenario: Erreur sans message
- **WHEN** le serveur répond par une erreur 500 sans corps lisible
- **THEN** l'écran affiche le message d'échec générique traduit

### Requirement: Réponse au format inattendu
Les réponses qui alimentent l'état de l'application (collection, liste de souhaits, decks, tournois, boutiques, partages, compte) MUST être vérifiées avant d'être utilisées. Une réponse au format inattendu MUST être traitée comme un échec : message d'erreur traduit, données affichées inchangées, erreur signalée pour diagnostic. Le catalogue MUST NOT être vérifié ainsi.

#### Scenario: Ancienne version de l'interface après un déploiement
- **WHEN** l'interface en cache reçoit pour la liste de souhaits une réponse dont un champ attendu manque
- **THEN** l'écran affiche un message d'erreur traduit, la liste affichée reste celle d'avant et l'application ne plante pas

#### Scenario: Réponse modifiée en file de synchronisation
- **WHEN** une modification de collection envoyée depuis la file reçoit une réponse au format inattendu
- **THEN** la modification n'est pas considérée comme refusée définitivement et la collection affichée est rechargée depuis le serveur

### Requirement: Lectures identiques regroupées
Quand plusieurs parties de l'application demandent la même donnée au même moment, une seule requête MUST partir au serveur et toutes MUST recevoir la même réponse. Revenir sur un écran déjà chargé MUST afficher aussitôt la dernière réponse connue puis la mettre à jour.

#### Scenario: Deux composants demandent la même donnée
- **WHEN** deux composants d'un écran demandent la liste des boutiques de l'utilisateur au même moment
- **THEN** une seule requête part au serveur

### Requirement: Comportement visible inchangé
En dehors des messages d'erreur, les écrans MUST se comporter comme avant : mêmes données affichées, mêmes chargements, même fonctionnement hors ligne et même ordre d'envoi des modifications en attente.

#### Scenario: Parcours habituels
- **WHEN** les parcours e2e existants (collection, decks, tournois, hors ligne, liste de souhaits) sont rejoués
- **THEN** ils réussissent sans modification de leurs attentes
