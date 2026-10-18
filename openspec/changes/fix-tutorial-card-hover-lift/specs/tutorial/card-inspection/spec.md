# Spec Delta

## Purpose

Permettre au joueur d'examiner une carte du tutoriel jouable (la soulever et lire sa fiche) sans qu'elle soit coupée par le plateau et sans que la fiche cache la carte.

## ADDED Requirements

### Requirement: Carte soulevée au-dessus du plateau
Quand le joueur survole une carte face visible du tutoriel à la souris, ou l'examine par un appui long au doigt, la carte MUST s'afficher agrandie et redressée au-dessus de tout le plateau, entière, sans être coupée par le bord du plateau ni par le bord de sa zone (main, Field, Field rival).

#### Scenario: Carte de la main survolée
- **WHEN** le joueur survole à la souris une carte de sa main, en bas du plateau
- **THEN** la carte apparaît agrandie, droite et entière, y compris son bord inférieur, devant le plateau et devant les cartes voisines

#### Scenario: Carte du Field rival survolée
- **WHEN** le joueur survole une carte du Field rival, en haut du plateau
- **THEN** la carte apparaît agrandie et entière, y compris son bord supérieur

#### Scenario: Plateau plein écran sur téléphone
- **WHEN** le tutoriel est en plein écran (téléphone) et le joueur fait un appui long sur une carte
- **THEN** la carte soulevée apparaît au-dessus du plateau plein écran

#### Scenario: Carte face cachée
- **WHEN** le joueur survole une carte face cachée
- **THEN** rien n'est soulevé et aucune fiche n'apparaît

### Requirement: Une seule carte visible à son emplacement
Pendant qu'une carte est soulevée, sa copie restée dans la zone MUST être invisible, sans que la place qu'elle occupe change, et MUST rester celle qui reçoit le pointeur et le clic. La carte soulevée MUST disparaître dès que le survol ou l'appui long se termine.

#### Scenario: Pas de double carte
- **WHEN** une carte inclinée de l'éventail de la main est soulevée
- **THEN** seule la carte soulevée, droite, est visible : aucun coin de la carte inclinée ne dépasse derrière, et les cartes voisines ne bougent pas

#### Scenario: Fin du survol
- **WHEN** le pointeur quitte la carte
- **THEN** la carte soulevée disparaît et la carte reprend son aspect normal dans sa zone

#### Scenario: Clic sur la carte attendue
- **WHEN** le joueur clique sur la carte attendue (qui pulse) pendant qu'elle est soulevée
- **THEN** l'action du tutoriel se déclenche comme sans soulèvement

### Requirement: Aspect de la carte soulevée
La carte soulevée MUST montrer le même visuel que la carte en place : l'image, l'équipement attaché, l'indication « spent » et le grisé d'une carte dépensée, ainsi que le liseré d'une carte attendue ou sélectionnée.

#### Scenario: Unit équipée
- **WHEN** le joueur survole une Unit de son Field qui porte un Gear
- **THEN** la carte soulevée montre aussi le Gear attaché

#### Scenario: Carte dépensée
- **WHEN** le joueur survole une carte dépensée, couchée sur le Field
- **THEN** la carte soulevée est droite mais garde le grisé et l'indication « spent »

### Requirement: Fiche zoom sans recouvrir la carte
La fiche zoom (image, nom, type, coût, puissance, description) MUST s'afficher entièrement dans l'écran, au-dessus de la carte soulevée, et MUST NOT recouvrir la carte soulevée. Sa position MUST tenir compte de sa hauteur réelle, quelle que soit la langue.

#### Scenario: Description longue
- **WHEN** le joueur survole une carte dont la description s'étend sur plusieurs lignes (en allemand par exemple)
- **THEN** la fiche est entièrement au-dessus, en dessous ou à côté de la carte soulevée, sans la chevaucher

#### Scenario: Carte près du haut de l'écran
- **WHEN** la place manque au-dessus de la carte soulevée
- **THEN** la fiche se place en dessous, ou à côté si la place manque aussi en dessous, sans recouvrir la carte

### Requirement: Déplacement d'une carte soulevée
Quand une action du tutoriel déplace une carte qui était soulevée, l'animation de déplacement MUST montrer la carte visible pendant tout le vol, comme pour une carte non survolée.

#### Scenario: Carte jouée depuis la main
- **WHEN** le joueur clique sur une carte de sa main soulevée par le survol et qu'elle part vers le Field, la Trash ou les Eddies
- **THEN** la carte vole visiblement de la main vers sa destination, sans disparaître ni laisser la carte soulevée à l'écran

### Requirement: Mouvements réduits
Si le système demande des mouvements réduits, la carte soulevée MUST apparaître et disparaître sans animation.

#### Scenario: Préférence « réduire les animations »
- **WHEN** le joueur, avec cette préférence active, survole une carte
- **THEN** la carte soulevée apparaît immédiatement, sans effet de grossissement
