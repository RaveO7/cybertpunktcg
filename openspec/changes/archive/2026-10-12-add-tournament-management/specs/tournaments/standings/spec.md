## Purpose

Calculer un classement suisse déterministe et explicable (points de match puis tie-breakers standards), toujours à jour des résultats validés, qui sert à la fois à l'affichage, aux appariements et à la qualification au top cut.

## ADDED Requirements

### Requirement: Points de match
Chaque match validé de la phase suisse MUST rapporter 3 points au vainqueur, 1 point à chaque joueur en cas de nul, 0 au perdant et 0 aux deux joueurs en cas de double défaite. Un bye MUST rapporter 3 points. Les matchs de top cut MUST NOT modifier les points de match.

#### Scenario: Bilan 2-1-0
- **WHEN** un joueur a deux victoires et un nul validés
- **THEN** il a 7 points de match

### Requirement: Pourcentage de victoires de match
Le pourcentage de victoires de match d'un joueur MUST valoir ses points de match divisés par 3 × le nombre de ses matchs suisses validés (bye compris), avec un plancher de 33 %.

#### Scenario: Plancher appliqué
- **WHEN** un joueur a 0 victoire en 3 matchs
- **THEN** son pourcentage de victoires de match utilisé dans les tie-breakers est 33 %

### Requirement: Pourcentage de manches gagnées
Le pourcentage de manches gagnées d'un joueur (GW%) MUST valoir ses manches gagnées × 3 + ses manches nulles × 1, divisé par 3 × le nombre de manches jouées, avec un plancher de 33 %. Un bye MUST compter comme deux manches gagnées. Un ID et une double défaite MUST compter comme zéro manche jouée.

#### Scenario: Victoires 2-1 et 2-0
- **WHEN** un joueur a gagné 2-1 puis 2-0
- **THEN** il a gagné 4 manches sur 5 jouées, soit un GW% de 80 %

### Requirement: Tie-breakers des adversaires
L'OMW% d'un joueur MUST être la moyenne des pourcentages de victoires de match (plancher compris) de tous ses adversaires de phase suisse, et l'OGW% la moyenne de leurs GW%. Le bye MUST être exclu de ces moyennes. Les adversaires droppés ou disqualifiés MUST y rester, avec leurs résultats arrêtés au moment de leur départ.

#### Scenario: Bye exclu
- **WHEN** un joueur a eu un bye puis deux adversaires à 2/3 (66,7 %) et 33 %
- **THEN** son OMW% vaut environ 49,8 %, le bye n'entrant pas dans la moyenne

#### Scenario: Adversaire droppé
- **WHEN** un ancien adversaire se droppe après une victoire et une défaite
- **THEN** il compte toujours dans l'OMW% avec 50 %

### Requirement: Ordre du classement
Le classement MUST trier les joueurs par points de match, puis OMW%, puis GW%, puis OGW%, en ordre décroissant. Les joueurs droppés et DQ MUST rester au classement avec leur mention. Le classement MUST être recalculé à partir de tous les matchs validés à chaque consultation ou modification, et MUST afficher les valeurs des tie-breakers.

#### Scenario: Égalité de points
- **WHEN** deux joueurs ont 9 points, l'un avec 60 % d'OMW et l'autre 55 %
- **THEN** le joueur à 60 % est classé devant

### Requirement: Égalité parfaite
Quand deux joueurs ou plus sont à égalité sur tous les critères, l'affichage MUST les montrer à égalité. Si cette égalité détermine une qualification au top cut, le système MUST effectuer un tirage au sort, enregistré et visible de tous (participants, résultat, date).

#### Scenario: Égalité au seuil du top 8
- **WHEN** les 8e et 9e sont à égalité sur tous les critères à la fin de la phase suisse
- **THEN** un tirage au sort désigne le qualifié, et le classement affiche « départagé par tirage au sort »

### Requirement: Classement final
À la fin du tournoi, le classement final MUST placer les joueurs du top cut selon le tour atteint (champion, finaliste, demi-finalistes, etc., départagés à tour égal par le classement suisse), puis les autres joueurs selon le classement suisse.

#### Scenario: Demi-finaliste mieux classé en suisse
- **WHEN** le 1er de la phase suisse perd en demi-finale
- **THEN** il est classé 3e ou 4e au classement final, derrière le champion et le finaliste
