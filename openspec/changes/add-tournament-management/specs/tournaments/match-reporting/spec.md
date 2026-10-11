## Purpose

Enregistrer le résultat de chaque match de façon fiable, que les deux joueurs, un seul ou aucun n'aient l'app, en laissant toujours le dernier mot à l'organisateur et sans qu'une saisie concurrente n'écrase silencieusement une autre.

## ADDED Requirements

### Requirement: Scores autorisés
Un résultat MUST indiquer le nombre de manches gagnées par chaque joueur. En Bo3, chaque valeur MUST être entre 0 et 2, sans que les deux valent 2 (2-0, 2-1, 1-0, 1-1, 0-0 et leurs inverses). En Bo1, seuls 1-0, 0-1 et 0-0 MUST être acceptés. Le gagnant du match est celui qui a le plus de manches ; à égalité, le match est nul.

#### Scenario: Score impossible
- **WHEN** un joueur déclare 3-0 dans un match Bo3
- **THEN** la déclaration est refusée

#### Scenario: Temps écoulé à 1-1
- **WHEN** le score 1-1 est validé en phase suisse
- **THEN** le match est nul et chaque joueur reçoit 1 point

### Requirement: Résultats spéciaux
Le TO MUST pouvoir saisir une double défaite (aucun des deux joueurs ne marque de point, aucune manche gagnée). Les deux joueurs MUST pouvoir s'accorder sur un nul intentionnel (ID), compté comme un nul 0-0. Ces résultats MUST être interdits en top cut.

#### Scenario: ID en dernière ronde
- **WHEN** un joueur déclare un ID et son adversaire le confirme
- **THEN** le match est validé comme nul 0-0 et chacun reçoit 1 point

### Requirement: Pas de nul en top cut
Un match de top cut MUST avoir un gagnant. Un score à égalité MUST être refusé en top cut.

#### Scenario: 1-1 en demi-finale
- **WHEN** quelqu'un saisit 1-1 pour une demi-finale
- **THEN** la saisie est refusée avec le message qu'un vainqueur est requis

### Requirement: États d'un match
Un match MUST être dans l'un des états `en_cours`, `declare`, `conteste` ou `valide`. Seul un résultat `valide` MUST compter au classement. Un bye est créé directement `valide`.

#### Scenario: Résultat déclaré non compté
- **WHEN** un match est `declare` mais pas encore confirmé
- **THEN** le classement affiché ne compte pas encore ce match

### Requirement: Saisie quand les deux joueurs ont l'app
Quand les deux joueurs ont un appareil lié, l'un MUST pouvoir déclarer le score (état `declare`) et l'autre le confirmer (état `valide`) ou le refuser (état `conteste`). Le déclarant MUST pouvoir modifier sa déclaration tant qu'elle n'est pas confirmée.

#### Scenario: Confirmation
- **WHEN** A déclare 2-1 pour A et B confirme
- **THEN** le match est validé 2-1 pour A

#### Scenario: Désaccord
- **WHEN** A déclare 2-1 pour A et B le refuse
- **THEN** le match passe `conteste` et apparaît en tête de liste chez le TO

### Requirement: Déclarations concurrentes
Si les deux joueurs déclarent sans voir la déclaration de l'autre, des scores identiques MUST valider le match, et des scores différents MUST le passer `conteste`. Aucune déclaration MUST NOT en écraser une autre silencieusement.

#### Scenario: Deux déclarations identiques
- **WHEN** A et B déclarent tous deux 2-0 pour A au même moment
- **THEN** le match est validé 2-0 pour A

#### Scenario: Deux déclarations différentes
- **WHEN** A déclare 2-1 pour A et B déclare 2-1 pour B au même moment
- **THEN** le match passe `conteste` avec les deux scores visibles par le TO

### Requirement: Saisie quand un seul joueur a l'app
Quand un seul joueur a un appareil lié, il MUST pouvoir déclarer le score puis faire confirmer l'adversaire sur le même appareil (« Je confirme, je suis X »). Selon un réglage du tournoi, cette confirmation MUST soit valider le match, soit le laisser `declare` en attente du TO (par défaut : validation directe).

#### Scenario: Validation directe
- **WHEN** le réglage est « validation directe » et l'adversaire confirme sur le téléphone du déclarant
- **THEN** le match est validé

#### Scenario: Validation par le TO
- **WHEN** le réglage est « validation par le TO » et l'adversaire confirme sur le même téléphone
- **THEN** le match reste `declare` avec la mention « confirmé sur place » et le TO le valide en un clic

### Requirement: Saisie quand aucun joueur n'a l'app
Un match dont aucun joueur n'a d'appareil lié MUST être saisi par le TO, et MUST apparaître dans sa liste « à saisir ».

#### Scenario: Deux joueurs papier
- **WHEN** la ronde démarre et un match oppose deux joueurs papier
- **THEN** le match apparaît chez le TO comme « à saisir »

### Requirement: Pouvoirs de l'organisateur
Le TO et les co-organisateurs MUST pouvoir saisir, valider, modifier ou annuler le résultat de n'importe quel match, quel que soit son état, ce qui le passe `valide` (ou `en_cours` s'il est annulé). Chaque modification MUST être historisée (auteur, date, ancien et nouveau score) et consultable.

#### Scenario: Contestation tranchée
- **WHEN** le TO saisit 2-1 pour B sur un match `conteste`
- **THEN** le match est validé 2-1 pour B et l'historique conserve les deux déclarations

### Requirement: Organisateur qui joue
Un organisateur inscrit comme joueur MUST NOT pouvoir valider seul son propre match en tant qu'organisateur : sa déclaration suit les règles d'un joueur (confirmation de l'adversaire, sur son appareil ou sur le même téléphone), ou la validation d'un autre organisateur.

#### Scenario: TO déclare sa propre victoire
- **WHEN** le TO, joueur, saisit 2-0 pour lui depuis l'écran d'organisation
- **THEN** le match reste `declare` jusqu'à la confirmation de l'adversaire ou d'un co-organisateur

### Requirement: Contrôle d'accès à la déclaration
Seuls les deux joueurs du match (via leur appareil lié ou leur compte) et les organisateurs MUST pouvoir déclarer ou confirmer. Toute autre tentative MUST être refusée (403), y compris par un joueur du même tournoi.

#### Scenario: Déclaration pour un autre match
- **WHEN** le joueur C envoie un score pour le match A–B
- **THEN** le serveur répond 403 et le match est inchangé

### Requirement: No-show
Le TO MUST pouvoir, en un clic, donner une défaite par absence à un joueur d'un match en cours : le match est validé 2-0 (ou 1-0 en Bo1) pour l'adversaire. Le TO MUST pouvoir en même temps dropper le joueur absent.

#### Scenario: Joueur absent
- **WHEN** le TO déclare B absent à la table 5
- **THEN** le match est validé 2-0 pour A

### Requirement: Déclaration non confirmée
Une déclaration restée sans confirmation ni refus plus longtemps que le délai du tournoi (10 minutes par défaut, réglable) MUST être signalée au TO comme « en attente trop longue ». Le système MUST NOT la valider automatiquement.

#### Scenario: Adversaire parti sans confirmer
- **WHEN** A a déclaré depuis 12 minutes et B n'a rien fait
- **THEN** le match apparaît au TO comme « en attente trop longue » et reste `declare`

### Requirement: Clôture de ronde
Le TO MUST pouvoir clôturer une ronde uniquement quand tous ses matchs sont `valide`. L'écran de clôture MUST lister les matchs restants et permettre de les saisir directement.

#### Scenario: Match encore déclaré
- **WHEN** le TO clôture la ronde alors qu'un match est `declare`
- **THEN** la clôture est refusée et le match est proposé à la saisie

### Requirement: Correction après coup en phase suisse
Le TO MUST pouvoir corriger un résultat d'une ronde déjà clôturée. Le classement MUST être recalculé ; les rondes déjà appariées MUST rester inchangées et le système MUST afficher un avertissement indiquant qu'elles reposaient sur l'ancien résultat.

#### Scenario: Erreur découverte en ronde 4
- **WHEN** le TO corrige un résultat de la ronde 2 pendant la ronde 4
- **THEN** le classement change, les appariements de la ronde 4 restent identiques et un avertissement est affiché

### Requirement: Correction après coup en top cut
Le TO MUST pouvoir corriger un match de top cut tant que le match suivant de ce vainqueur n'a pas démarré ; le match suivant MUST alors être mis à jour avec le nouveau vainqueur. Une fois le match suivant démarré, la correction MUST être refusée.

#### Scenario: Erreur en quart avant les demis
- **WHEN** le TO inverse le vainqueur d'un quart avant le démarrage des demi-finales
- **THEN** la demi-finale concernée oppose le nouveau vainqueur
