## Purpose

Limiter le nombre de participants d'un tournoi à la place disponible et gérer équitablement les inscriptions au-delà grâce à une liste d'attente ordonnée.

## ADDED Requirements

### Requirement: Nombre de places
Un organisateur MUST pouvoir fixer un nombre de places maximum (entre 2 et 512) ou n'en fixer aucun. Les joueurs actifs et en attente d'approbation MUST occuper une place ; les joueurs droppés, disqualifiés ou en liste d'attente MUST NOT en occuper.

#### Scenario: Sans limite
- **WHEN** aucun nombre de places n'est fixé
- **THEN** les inscriptions ne sont jamais mises en liste d'attente

#### Scenario: Approbation en cours
- **WHEN** un tournoi de 8 places compte 6 joueurs actifs et 2 en attente d'approbation
- **THEN** le tournoi est complet

### Requirement: Liste d'attente
Quand le tournoi est complet, une nouvelle inscription (par code, par la fiche publique ou par compte) MUST être acceptée en liste d'attente, avec sa position. Un joueur en liste d'attente MUST NOT être apparié ni compter dans le classement.

#### Scenario: Tournoi complet
- **WHEN** une personne s'inscrit à un tournoi de 16 places qui a 16 joueurs actifs
- **THEN** elle est inscrite en liste d'attente en position 1 et sa vue joueur l'indique

#### Scenario: Ronde appariée avec une liste d'attente
- **WHEN** le TO apparie la ronde 1 alors que 2 joueurs sont en liste d'attente
- **THEN** ces 2 joueurs ne figurent dans aucun match

### Requirement: Promotion automatique
Quand une place se libère (retrait, refus, suppression ou drop d'un joueur, ou hausse du nombre de places) et que les inscriptions sont encore possibles, le premier joueur de la liste d'attente MUST être promu automatiquement, avec le statut qu'il aurait eu en s'inscrivant (actif, ou en attente d'approbation si l'approbation est requise). L'ordre MUST être l'ordre d'inscription.

#### Scenario: Désistement
- **WHEN** un joueur actif se retire d'un tournoi complet avant la ronde 1
- **THEN** le premier de la liste d'attente devient actif et sa vue joueur l'indique

#### Scenario: Places ajoutées
- **WHEN** le TO passe le nombre de places de 16 à 18 alors que 3 joueurs attendent
- **THEN** les 2 premiers en attente sont promus et le troisième passe en position 1

#### Scenario: Inscriptions terminées
- **WHEN** une place se libère après la fin des inscriptions
- **THEN** personne n'est promu

### Requirement: Contrôle du TO sur la liste d'attente
Le TO MUST voir la liste d'attente dans l'ordre et pouvoir promouvoir manuellement n'importe quel joueur en attente, même si le tournoi est complet (dépassement volontaire). Un joueur papier ajouté par le TO MUST être actif sans tenir compte de la limite.

#### Scenario: Dépassement volontaire
- **WHEN** le TO promeut le 3ᵉ joueur en attente d'un tournoi complet de 16 places
- **THEN** ce joueur devient actif et le tournoi compte 17 joueurs actifs

### Requirement: Baisse du nombre de places
Baisser le nombre de places MUST NOT désinscrire ni rétrograder un joueur déjà actif ; seules les inscriptions suivantes en tiennent compte.

#### Scenario: Limite inférieure aux inscrits
- **WHEN** le TO passe le nombre de places à 10 alors que 12 joueurs sont actifs
- **THEN** les 12 joueurs restent actifs et toute nouvelle inscription va en liste d'attente

### Requirement: Retrait de la liste d'attente
Un joueur en liste d'attente MUST pouvoir se retirer lui-même ; les positions suivantes MUST être recalculées.

#### Scenario: Retrait en attente
- **WHEN** le joueur en position 1 se retire de la liste d'attente
- **THEN** il n'est plus inscrit et l'ancien numéro 2 passe en position 1
