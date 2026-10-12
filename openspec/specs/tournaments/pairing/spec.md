# tournaments/pairing Specification

## Purpose
Produire à chaque ronde des appariements suisses justes et toujours possibles, permettre au TO de les corriger avant le début de la ronde, puis construire l'arbre d'élimination directe du top cut.

## Requirements

### Requirement: Nombre de rondes suisses
En format boutique, le tournoi MUST compter 3 rondes suisses, quel que soit le nombre de joueurs. En format compétitif, le nombre proposé MUST être ⌈log₂(joueurs actifs)⌉, avec un minimum de 3, calculé au démarrage. Le TO MUST pouvoir ajuster ce nombre tant que la dernière ronde prévue n'a pas démarré, sans descendre sous le nombre de rondes déjà démarrées.

#### Scenario: Compétitif à 20 joueurs
- **WHEN** un tournoi compétitif démarre avec 20 joueurs
- **THEN** 5 rondes suisses sont prévues

#### Scenario: Boutique à 30 joueurs
- **WHEN** un tournoi boutique démarre avec 30 joueurs
- **THEN** 3 rondes suisses sont prévues

### Requirement: Appariement de la première ronde
Les joueurs actifs et approuvés de la ronde 1 MUST être appariés aléatoirement.

#### Scenario: Ronde 1
- **WHEN** le TO apparie la ronde 1 avec 8 joueurs
- **THEN** 4 matchs sont créés avec des tables numérotées de 1 à 4, dans un ordre aléatoire

### Requirement: Appariement suisse des rondes suivantes
À partir de la ronde 2, le système MUST apparier les joueurs actifs ayant le même nombre de points de match, du groupe le plus haut au plus bas ; un joueur restant seul dans son groupe MUST être apparié avec un joueur du groupe immédiatement inférieur. Deux joueurs qui se sont déjà affrontés dans le tournoi MUST NOT être appariés de nouveau tant qu'un appariement complet sans revanche existe.

#### Scenario: Pas de revanche
- **WHEN** A et B se sont affrontés en ronde 1 et ont tous deux 3 points
- **THEN** A et B ne sont pas appariés en ronde 2 si une autre combinaison complète existe

#### Scenario: Groupe impair
- **WHEN** trois joueurs ont 6 points et les autres moins
- **THEN** deux d'entre eux jouent ensemble et le troisième affronte un joueur à 3 points

### Requirement: Revanche en dernier recours
Si aucun appariement complet sans revanche n'existe, le système MUST produire l'appariement qui minimise le nombre de revanches, signaler chaque revanche au TO et ne jamais bloquer la ronde.

#### Scenario: 4 joueurs, 4e ronde
- **WHEN** 4 joueurs ont déjà tous joué les uns contre les autres et une 4e ronde est appariée
- **THEN** la ronde est appariée avec des revanches signalées comme telles

### Requirement: Bye
Avec un nombre impair de joueurs actifs, le système MUST attribuer un bye au joueur au plus petit nombre de points, puis au moins bien classé, qui n'a pas encore eu de bye. Le bye MUST compter comme une victoire 2-0 (ou 1-0 en Bo1) et être validé immédiatement. Si tous les joueurs ont déjà eu un bye, le moins bien classé reçoit un second bye.

#### Scenario: 7 joueurs
- **WHEN** la ronde 2 est appariée avec 7 joueurs actifs
- **THEN** le joueur le moins bien classé sans bye reçoit un bye validé à 3 points, et 3 matchs sont créés

#### Scenario: Pas de bye en top cut
- **WHEN** le top cut est apparié
- **THEN** aucun bye n'est attribué

### Requirement: Joueurs exclus de l'appariement
L'appariement d'une ronde MUST exclure les joueurs droppés, disqualifiés, non approuvés ou arrivés après le début de la ronde.

#### Scenario: Joueur droppé
- **WHEN** un joueur s'est droppé pendant la ronde 2
- **THEN** il n'apparaît dans aucun match de la ronde 3

### Requirement: Publication et démarrage séparés
L'appariement d'une ronde MUST d'abord être un brouillon visible du seul TO. Le TO MUST le publier pour que les joueurs le voient, puis démarrer la ronde, ce qui lance le chrono. Une seule ronde MUST pouvoir être en cours à la fois, et une ronde ne MUST être appariée qu'une fois la précédente clôturée.

#### Scenario: Ronde précédente non clôturée
- **WHEN** le TO tente d'apparier la ronde 3 alors que la ronde 2 n'est pas clôturée
- **THEN** l'action est refusée

### Requirement: Corrections manuelles avant démarrage
Tant qu'une ronde n'a pas démarré, le TO MUST pouvoir échanger deux joueurs entre deux matchs, déplacer le bye, ou relancer complètement l'appariement. Le système MUST signaler (sans l'interdire) une correction qui crée une revanche ou donne un second bye. Après le démarrage, les appariements MUST être figés.

#### Scenario: Échange de deux joueurs
- **WHEN** le TO échange B (table 1) et D (table 2) avant le démarrage
- **THEN** les tables deviennent A–D et C–B, et les joueurs voient les nouvelles tables

#### Scenario: Ronde démarrée
- **WHEN** le TO tente d'échanger deux joueurs après le démarrage de la ronde
- **THEN** l'action est refusée

### Requirement: Sélection du top cut
À la clôture de la dernière ronde suisse, si le top cut n'est pas `aucun`, le système MUST qualifier les N premiers joueurs non droppés et non DQ du classement. En réglage `auto`, N MUST valoir 0 sous 9 joueurs, 4 de 9 à 16, 8 de 17 à 64, 16 au-delà. Si N est supérieur ou égal au nombre de joueurs restants, le système MUST utiliser la plus grande puissance de 2 strictement inférieure.

#### Scenario: Top cut auto à 20 joueurs
- **WHEN** la phase suisse d'un tournoi à 20 joueurs se termine avec le top cut `auto`
- **THEN** les 8 premiers sont qualifiés

#### Scenario: Top 8 avec 8 joueurs
- **WHEN** le top cut est fixé à 8 et seuls 8 joueurs restent
- **THEN** un top 4 est utilisé

### Requirement: Remplacement d'un qualifié
Avant le démarrage du premier tour de top cut, le TO MUST pouvoir retirer un qualifié qui décline ; le joueur suivant au classement MUST prendre sa place et l'arbre MUST être recalculé.

#### Scenario: Qualifié qui doit partir
- **WHEN** le 3e du classement décline le top 8
- **THEN** le 9e est qualifié et l'arbre est reconstruit selon le nouveau classement des qualifiés

### Requirement: Arbre du top cut
Le premier tour MUST opposer les qualifiés selon leur rang de classement en suisse (1 contre N, 2 contre N−1…), dans un arbre où les deux premiers ne peuvent se rencontrer qu'en finale. Chaque tour suivant MUST être apparié automatiquement à la clôture du précédent, le vainqueur de chaque match avançant. Le dernier match gagné désigne le champion et termine le tournoi.

#### Scenario: Top 8
- **WHEN** le top 8 est apparié
- **THEN** les quarts sont 1–8, 4–5, 2–7, 3–6, et les demi-finales opposent les vainqueurs de 1–8/4–5 et de 2–7/3–6

#### Scenario: Finale jouée
- **WHEN** la finale est validée
- **THEN** le tournoi passe à `termine` avec le vainqueur comme champion
