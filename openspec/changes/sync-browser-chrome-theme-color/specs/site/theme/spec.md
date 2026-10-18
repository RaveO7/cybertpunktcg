# Spec Delta

## Purpose

Définit le thème visuel de l'application (sombre par défaut, clair au choix de l'utilisateur) et garantit que les barres du navigateur et du système d'exploitation s'accordent avec ce thème plutôt qu'avec celui de l'appareil.

## ADDED Requirements

### Requirement: Thème sombre par défaut, indépendant de l'appareil
L'application SHALL s'afficher en thème sombre tant que l'utilisateur n'a pas choisi le thème clair, quel que soit le thème de l'appareil ou du navigateur.

#### Scenario: Appareil en thème clair, aucune préférence
- **WHEN** un visiteur sans préférence enregistrée ouvre l'application sur un appareil en thème clair
- **THEN** l'application s'affiche en thème sombre

#### Scenario: Thème clair choisi
- **WHEN** l'utilisateur a choisi le thème clair dans les réglages
- **THEN** l'application s'affiche en thème clair, y compris sur un appareil en thème sombre

### Requirement: Couleur des barres accordée au thème de l'application
La couleur annoncée au navigateur pour ses barres et celles du système (`theme-color`) SHALL correspondre au thème actif de l'application : `#07080d` en thème sombre, `#e8eef6` en thème clair. Elle MUST NOT dépendre du thème de l'appareil.

#### Scenario: Appareil clair, application sombre
- **WHEN** l'application est en thème sombre sur un appareil en thème clair
- **THEN** la page annonce une seule couleur de barres, `#07080d`, sans variante liée à `prefers-color-scheme`

#### Scenario: Application en thème clair
- **WHEN** l'application est en thème clair
- **THEN** la page annonce la couleur de barres `#e8eef6`

### Requirement: Bonne couleur dès le premier affichage
La couleur des barres SHALL être celle du thème enregistré dès le premier affichage de la page, avant l'exécution de l'application côté client. Sans préférence enregistrée, ou si elle est illisible, la couleur MUST être celle du thème sombre.

#### Scenario: Ouverture avec le thème clair enregistré
- **WHEN** un utilisateur ayant enregistré le thème clair ouvre une page
- **THEN** les barres sont claires dès le premier affichage, sans passage par la couleur sombre

#### Scenario: Ouverture sans préférence
- **WHEN** un visiteur sans préférence enregistrée ouvre une page
- **THEN** les barres sont sombres dès le premier affichage, sans passage par une couleur claire

### Requirement: Changement de thème appliqué immédiatement aux barres
Quand le thème change (choix dans les réglages, réinitialisation des préférences ou changement fait dans un autre onglet), la couleur des barres SHALL suivre le nouveau thème sans rechargement de la page.

#### Scenario: Passage au thème clair
- **WHEN** l'utilisateur passe du thème sombre au thème clair dans les réglages
- **THEN** la couleur des barres devient `#e8eef6` sans rechargement

#### Scenario: Réinitialisation des préférences
- **WHEN** l'utilisateur en thème clair réinitialise ses préférences
- **THEN** l'application et la couleur des barres repassent en thème sombre (`#07080d`)
