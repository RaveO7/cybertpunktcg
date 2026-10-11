## Purpose

Faire entrer chaque participant dans un tournoi sous une identité unique, qu'il ait l'app ou non, et gérer sa présence (approbation, retard, retrait, drop, DQ) sans jamais perdre ni dupliquer un joueur.

## ADDED Requirements

### Requirement: Un seul type de joueur
Chaque participant MUST être représenté par un joueur de tournoi portant un pseudo, éventuellement lié à un compte, et indiquant s'il a un appareil lié. Appariements, classement et saisie des résultats MUST traiter de la même façon un joueur inscrit par code, un joueur papier et un joueur récupéré.

#### Scenario: Joueur papier apparié
- **WHEN** une ronde est appariée avec des joueurs papier et des joueurs équipés
- **THEN** l'appariement ne tient compte que des points et de l'historique, pas de la façon dont le joueur s'est inscrit

### Requirement: Inscription par code ou QR code
Une personne qui ouvre l'URL du tournoi (QR) ou saisit son code MUST pouvoir s'inscrire tant que les inscriptions sont ouvertes : avec son compte (pseudo prérempli avec son nom affiché, modifiable) ou en invité avec un pseudo seul. L'appareil MUST ensuite rester lié à ce joueur. La saisie du code et l'inscription invité MUST être limitées en débit par IP.

#### Scenario: Invité sans compte
- **WHEN** une personne sans compte saisit le code et le pseudo « Neo »
- **THEN** un joueur « Neo » est créé, lié à cet appareil, et la personne voit la page du tournoi en tant que Neo

#### Scenario: Compte déjà inscrit
- **WHEN** un utilisateur déjà inscrit à ce tournoi avec son compte rouvre le QR code
- **THEN** il retrouve son joueur existant au lieu d'en créer un second

#### Scenario: Codes essayés en rafale
- **WHEN** une même IP essaie plus de 20 codes en une minute
- **THEN** les essais suivants sont refusés (429) jusqu'à la fin de la fenêtre

### Requirement: Joueur papier créé par le TO
Le TO MUST pouvoir créer un joueur avec un pseudo seul, sans compte ni appareil, à tout moment où une inscription est encore possible.

#### Scenario: Tournoi sans aucun téléphone joueur
- **WHEN** le TO crée 8 joueurs papier et démarre le tournoi
- **THEN** le tournoi se déroule entièrement depuis l'appareil du TO

### Requirement: QR code personnel et récupération de profil
Le TO MUST pouvoir afficher pour chaque joueur un QR code personnel à usage unique, valable 15 minutes. Le scanner MUST lier l'appareil (et le compte connecté s'il y en a un) à ce joueur en conservant son historique, et rendre caduc tout lien d'appareil précédent. Le TO MUST pouvoir le régénérer à volonté.

#### Scenario: Joueur papier récupère l'app
- **WHEN** « Lucas », créé par le TO, scanne son QR personnel en ronde 2
- **THEN** son téléphone affiche le profil Lucas avec son résultat de ronde 1, et il peut déclarer ses scores

#### Scenario: Téléphone perdu ou données effacées
- **WHEN** un invité a effacé les données de son navigateur et le TO lui montre un nouveau QR personnel
- **THEN** il retrouve son joueur sur l'appareil, et l'ancien appareil n'a plus accès à ce joueur

#### Scenario: QR personnel expiré
- **WHEN** un QR personnel est scanné plus de 15 minutes après son affichage, ou une seconde fois
- **THEN** il est refusé et le TO doit en générer un nouveau

### Requirement: Fusion de doublons
Le TO MUST pouvoir fusionner deux joueurs du même tournoi qui sont la même personne : le joueur conservé garde l'historique des deux, le lien d'appareil et de compte le plus récent. La fusion MUST être refusée si les deux joueurs ont joué l'un contre l'autre ou s'ils ont tous deux un match dans la même ronde.

#### Scenario: Lucas inscrit deux fois avant la ronde 1
- **WHEN** le TO a créé « Lucas » et Lucas s'est aussi inscrit par code sous « Lucas B », puis le TO fusionne les deux
- **THEN** il ne reste qu'un joueur, lié au téléphone de Lucas, et il ne peut pas être apparié contre lui-même

#### Scenario: Doublon détecté après des matchs dans la même ronde
- **WHEN** les deux profils ont chacun un match en ronde 1
- **THEN** la fusion est refusée et le TO est invité à dropper l'un des deux

### Requirement: Doublon signalé à l'inscription
Quand une inscription utilise un pseudo proche (même pseudo en ignorant casse, accents et espaces) d'un joueur papier existant, le système MUST proposer à la personne de demander à récupérer ce profil au TO plutôt que de créer un doublon.

#### Scenario: Pseudo proche d'un joueur papier
- **WHEN** quelqu'un s'inscrit sous « lucas » alors qu'un joueur papier « Lucas » existe
- **THEN** l'app lui indique qu'un joueur « Lucas » existe déjà et lui demande de faire scanner son QR personnel par le TO

### Requirement: Pseudos uniques par tournoi
Deux joueurs d'un même tournoi MUST NOT avoir le même pseudo (comparaison sans casse, accents ni espaces superflus). Une inscription par code avec un pseudo pris MUST être refusée avec une demande d'en choisir un autre. Le TO MUST pouvoir renommer un joueur, sous la même règle.

#### Scenario: Pseudo déjà pris
- **WHEN** un invité choisit « NEO » alors que « Neo » est déjà inscrit et n'est pas un joueur papier
- **THEN** l'inscription est refusée avec le message « pseudo déjà utilisé dans ce tournoi »

### Requirement: Approbation et fermeture des inscriptions
Le TO MUST pouvoir activer l'option « approuver chaque inscription » : les inscriptions par code sont alors en attente et ne participent à aucun appariement tant qu'il ne les a pas acceptées. Le TO MUST pouvoir fermer et rouvrir les inscriptions par code à tout moment ; fermées, seul le TO peut ajouter des joueurs.

#### Scenario: Inscription à distance
- **WHEN** l'approbation est active et une personne absente s'inscrit avec le code
- **THEN** elle apparaît « en attente », le TO la refuse et elle n'est jamais appariée

#### Scenario: Inscriptions fermées
- **WHEN** les inscriptions sont fermées et quelqu'un saisit le code pour s'inscrire
- **THEN** l'inscription est refusée, mais les joueurs déjà inscrits accèdent toujours au tournoi

### Requirement: Arrivée en retard
Le TO MUST pouvoir ajouter un joueur (papier ou en rouvrant les inscriptions) pendant la phase suisse. Le joueur MUST être apparié à partir de la prochaine ronde non démarrée. Selon un réglage du tournoi, les rondes manquées MUST compter soit comme rien (0 point, sans match), soit comme des défaites.

#### Scenario: Arrivée en ronde 2 sans pénalité
- **WHEN** un joueur est ajouté pendant la ronde 2 avec le réglage « 0 point »
- **THEN** il est apparié dès la ronde 3 avec 0 point et aucun match fictif n'apparaît dans son historique

### Requirement: Retrait avant le tournoi
Avant le démarrage de la ronde 1, le TO MUST pouvoir supprimer définitivement un joueur, et un joueur MUST pouvoir se désinscrire lui-même. Après le démarrage, la suppression MUST être remplacée par un drop.

#### Scenario: Inscrit absent
- **WHEN** le TO supprime un inscrit absent avant la ronde 1
- **THEN** le joueur disparaît du tournoi et son pseudo redevient libre

### Requirement: Drop
Un joueur actif MUST pouvoir se dropper depuis son appareil, et le TO MUST pouvoir dropper n'importe quel joueur. Le drop prend effet à la prochaine ronde non encore appariée : le match en cours ou déjà apparié reste à jouer ou à saisir. Un joueur droppé MUST rester au classement (marqué « drop ») et dans les tie-breakers de ses anciens adversaires.

#### Scenario: Drop pendant la ronde 3
- **WHEN** un joueur se droppe pendant la ronde 3
- **THEN** son match de ronde 3 doit encore recevoir un résultat, et il n'est plus apparié à partir de la ronde 4

#### Scenario: Drop d'un qualifié avant le top cut
- **WHEN** un joueur qualifié pour le top cut se droppe avant l'appariement du top cut
- **THEN** il est remplacé par le joueur suivant au classement

### Requirement: Réintégration
Le TO MUST pouvoir annuler le drop d'un joueur tant que la phase suisse n'est pas terminée ; le joueur est apparié à partir de la prochaine ronde non appariée, et les rondes manquées comptent comme pour une arrivée en retard.

#### Scenario: Drop par erreur
- **WHEN** le TO droppe le mauvais joueur puis le réintègre avant d'apparier la ronde suivante
- **THEN** le joueur est apparié normalement, sans aucune ronde manquée

### Requirement: Disqualification
Le TO MUST pouvoir disqualifier un joueur avec un motif. Une disqualification MUST avoir les mêmes effets qu'un drop, être définitive et être visible au classement (mention « DQ »). Le match en cours du joueur DQ MUST pouvoir être saisi en défaite par le TO.

#### Scenario: DQ en cours de ronde
- **WHEN** le TO disqualifie un joueur pendant la ronde 2
- **THEN** le joueur est marqué DQ, n'est plus apparié, et ne peut pas être réintégré

### Requirement: Conservation après suppression de compte
Supprimer un compte MUST NOT supprimer ses joueurs de tournoi ni leurs matchs : le lien au compte est retiré et le joueur conserve le pseudo qu'il avait dans le tournoi. Supprimer le compte d'un TO MUST NOT supprimer ses tournois s'il y reste un co-organisateur.

#### Scenario: Ancien adversaire supprime son compte
- **WHEN** un joueur supprime son compte après un tournoi terminé
- **THEN** ses matchs et le classement final restent identiques, sous son pseudo de tournoi
