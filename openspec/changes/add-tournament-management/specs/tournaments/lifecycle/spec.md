## Purpose

Permettre à un organisateur (TO) de créer, régler et conduire un tournoi de bout en bout depuis n'importe quel appareil, avec des co-organisateurs, sans que l'état du tournoi dépende d'un téléphone ou d'une connexion en particulier.

## ADDED Requirements

### Requirement: Création d'un tournoi
Seul un utilisateur connecté à un compte MUST pouvoir créer un tournoi ; il en devient l'organisateur principal. Un tournoi MUST avoir un nom, un format (`boutique` ou `competitif`), un type de match (`bo1` ou `bo3`), une durée de ronde en minutes et un réglage de top cut (`auto`, une taille fixe parmi 2/4/8/16/32, ou `aucun`). Valeurs par défaut : boutique, bo3, 50 min, top cut `aucun`.

#### Scenario: Création par un compte
- **WHEN** un utilisateur connecté crée un tournoi « Soirée vendredi » sans préciser de réglages
- **THEN** le tournoi est créé à l'état `inscriptions` avec format boutique, bo3, 50 minutes, sans top cut, et l'utilisateur en est l'organisateur principal

#### Scenario: Création refusée sans compte
- **WHEN** une requête de création arrive sans session de compte (invité ou anonyme)
- **THEN** le serveur répond 401 et aucun tournoi n'est créé

#### Scenario: Réglages invalides
- **WHEN** la durée de ronde est hors de 10 à 180 minutes ou la taille de top cut n'est pas autorisée
- **THEN** le serveur répond 400 avec un message explicite et rien n'est créé

### Requirement: Code d'accès du tournoi
Chaque tournoi MUST recevoir à sa création un code d'accès unique de 6 caractères, tiré d'un alphabet sans caractères ambigus (pas de 0/O, 1/I/L), insensible à la casse à la saisie. Le TO MUST pouvoir afficher ce code et un QR code contenant l'URL publique du tournoi, et régénérer le code (l'ancien cesse alors de fonctionner).

#### Scenario: Saisie en minuscules
- **WHEN** un joueur saisit `k7mq2x` pour un tournoi dont le code est `K7MQ2X`
- **THEN** il accède au tournoi

#### Scenario: Code régénéré
- **WHEN** le TO régénère le code puis quelqu'un saisit l'ancien code
- **THEN** le serveur répond « tournoi introuvable » et les joueurs déjà inscrits ne sont pas affectés

### Requirement: Modification des réglages
Le TO MUST pouvoir modifier tous les réglages tant que la première ronde n'a pas démarré. Après le démarrage de la ronde 1, seuls le nom, la durée des rondes suivantes, le réglage de top cut (tant que le top cut n'a pas commencé), le nombre de rondes suisses restantes et les réglages de saisie des résultats MUST rester modifiables.

#### Scenario: Changement de format après démarrage
- **WHEN** le TO tente de passer de bo3 à bo1 alors que la ronde 2 est en cours
- **THEN** la modification est refusée avec un message expliquant que le type de match est figé

### Requirement: Co-organisateurs
Le TO principal MUST pouvoir ajouter comme co-organisateur un utilisateur ayant un compte, via un lien d'invitation à usage unique, et le retirer. Un co-organisateur MUST disposer des mêmes pouvoirs que le TO principal, sauf supprimer le tournoi et gérer les co-organisateurs.

#### Scenario: Co-organisateur saisit un résultat
- **WHEN** un co-organisateur saisit le score d'un match
- **THEN** le résultat est validé comme s'il venait du TO principal

#### Scenario: Co-organisateur ne peut pas supprimer
- **WHEN** un co-organisateur tente de supprimer ou d'annuler le tournoi
- **THEN** le serveur répond 403

### Requirement: Cycle de vie
Un tournoi MUST suivre les états `inscriptions` → `suisse` → `top_cut` → `termine`, l'état `top_cut` étant sauté si aucun top cut n'est prévu. Le TO MUST pouvoir l'annuler depuis n'importe quel état sauf `termine` (état `annule`). Un tournoi `termine` ou `annule` MUST être en lecture seule, sauf la correction de résultats par le TO.

#### Scenario: Fin sans top cut
- **WHEN** la dernière ronde suisse est clôturée et le top cut vaut `aucun`
- **THEN** le tournoi passe à `termine` et le classement final est figé

#### Scenario: Tournoi annulé
- **WHEN** le TO annule un tournoi en cours
- **THEN** plus aucune inscription, déclaration ou ronde n'est possible, et les données restent consultables

### Requirement: Démarrage du tournoi
Le TO MUST pouvoir démarrer la première ronde uniquement s'il y a au moins 2 joueurs actifs et approuvés. Avec moins de 4 joueurs, le système MUST afficher un avertissement à confirmer. Le démarrage MUST être refusé tant que des inscriptions sont en attente d'approbation, sauf si le TO choisit de les refuser ou de les ignorer.

#### Scenario: Un seul joueur
- **WHEN** le TO démarre un tournoi avec un seul joueur actif
- **THEN** le démarrage est refusé

#### Scenario: Trois joueurs
- **WHEN** le TO démarre avec 3 joueurs
- **THEN** un avertissement est affiché et le démarrage n'a lieu qu'après confirmation

### Requirement: État entièrement côté serveur
Toute information nécessaire pour conduire le tournoi (joueurs, appariements, résultats, chrono, réglages) MUST être enregistrée côté serveur. Recharger la page, changer d'appareil ou se reconnecter MUST restituer exactement le même état.

#### Scenario: TO change de téléphone
- **WHEN** le TO perd son téléphone et se connecte à son compte sur un autre appareil en pleine ronde 3
- **THEN** il retrouve la ronde 3 en cours, les résultats déjà saisis et le chrono à jour

### Requirement: File d'actions hors connexion pour l'organisateur
Les actions du TO effectuées sans connexion MUST être conservées sur l'appareil, affichées comme « non synchronisées », puis renvoyées dans l'ordre au retour du réseau. Chaque action MUST porter un identifiant unique afin qu'un renvoi ne soit jamais appliqué deux fois. Une action devenue impossible MUST être signalée au TO au lieu d'être ignorée.

#### Scenario: Wi-Fi coupé pendant la saisie
- **WHEN** le TO saisit trois résultats sans réseau puis la connexion revient
- **THEN** les trois résultats sont envoyés, l'indicateur « non synchronisé » disparaît et chaque résultat n'est enregistré qu'une fois

#### Scenario: Action en conflit
- **WHEN** une action en file vise un match qu'un co-organisateur a déjà validé avec un autre score
- **THEN** l'action est rejetée et le TO voit le conflit avec les deux scores pour trancher

### Requirement: Rafraîchissement des écrans
Les écrans du TO et des joueurs MUST se mettre à jour automatiquement (au plus 10 secondes de retard tant que la page est visible) et immédiatement après une action de l'utilisateur, sans rechargement manuel.

#### Scenario: Résultat confirmé par les joueurs
- **WHEN** deux joueurs confirment leur match sur leurs téléphones
- **THEN** l'écran du TO affiche le match comme validé en moins de 10 secondes
