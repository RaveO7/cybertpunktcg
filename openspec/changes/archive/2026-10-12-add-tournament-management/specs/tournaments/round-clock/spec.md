## Purpose

Donner à tous les appareils le même temps restant pour la ronde en cours, réglé par l'organisateur (pause, temps ajouté, temps supplémentaire pour une table), sans dépendre de l'horloge des téléphones.

## ADDED Requirements

### Requirement: Horloge de référence serveur
Le temps restant d'une ronde MUST être calculé à partir de l'heure du serveur, de l'heure de démarrage de la ronde, de sa durée, des pauses et des ajouts de temps. Chaque appareil MUST corriger l'écart entre son horloge et celle du serveur avant d'afficher le décompte.

#### Scenario: Téléphone en avance de 3 minutes
- **WHEN** l'horloge d'un téléphone joueur a 3 minutes d'avance sur le serveur
- **THEN** il affiche le même temps restant que l'écran du TO, à la seconde près

### Requirement: Démarrage du chrono
Le chrono MUST démarrer quand le TO démarre la ronde, avec la durée de ronde du tournoi (top cut : durée de ronde + 25 minutes par défaut, réglable).

#### Scenario: Ronde de 50 minutes
- **WHEN** le TO démarre une ronde suisse dans un tournoi réglé à 50 minutes
- **THEN** tous les appareils affichent 50:00 et le décompte commence

### Requirement: Pause et reprise
Le TO MUST pouvoir mettre le chrono en pause puis le reprendre ; pendant la pause, le temps restant MUST rester figé sur tous les appareils.

#### Scenario: Pause de 5 minutes
- **WHEN** le TO met en pause à 30:00 restantes puis reprend 5 minutes plus tard
- **THEN** le chrono reprend à 30:00

### Requirement: Ajout de temps à la ronde
Le TO MUST pouvoir ajouter ou retirer des minutes au chrono de la ronde, sans descendre sous zéro.

#### Scenario: Ajout de 5 minutes
- **WHEN** le TO ajoute 5 minutes à 10:00 restantes
- **THEN** tous les appareils affichent 15:00

### Requirement: Temps supplémentaire pour une table
Le TO MUST pouvoir accorder du temps supplémentaire à un match précis (ex. après l'intervention d'un juge). Les joueurs de ce match MUST voir leur propre temps restant ; les autres le chrono général.

#### Scenario: Juge à la table 4
- **WHEN** le TO accorde 4 minutes à la table 4
- **THEN** les joueurs de la table 4 voient 4 minutes de plus que le chrono général, et le TO voit la table 4 marquée « +4 min »

### Requirement: Fin du temps
À la fin du temps, les appareils MUST afficher « Temps écoulé » (et, pour une table avec temps supplémentaire, à la fin de son propre temps). La fin du temps MUST NOT clôturer la ronde ni modifier les résultats.

#### Scenario: Temps écoulé
- **WHEN** le chrono atteint 0:00
- **THEN** les écrans affichent « Temps écoulé », et les matchs restent ouverts à la saisie
