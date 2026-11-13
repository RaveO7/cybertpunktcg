## ADDED Requirements

### Requirement: Squelette de chargement par écran
Le tableau de bord, l'investissement, les decks, la liste de souhaits et les réglages MUST afficher un squelette de chargement tant que les données dont ils dépendent (catalogue, collection, decks, souhaits, historique de prix) ne sont pas disponibles. Le squelette reprend la disposition générale de l'écran. Un écran MUST ne jamais afficher, pendant le chargement, de valeurs fausses (« 0 carte », « 0,00 € », liste vide, « aucun deck ») ni d'état vide destiné à un compte sans données.

#### Scenario: Tableau de bord pendant le chargement
- **WHEN** un utilisateur ouvre le tableau de bord avant l'arrivée du catalogue et de la collection
- **THEN** il voit un squelette, et non « 0 carte » ni une valeur de collection à 0 €

#### Scenario: Compte réellement vide
- **WHEN** les données sont chargées et que le compte n'a aucune carte
- **THEN** l'écran affiche l'état vide prévu pour une collection vide

### Requirement: Squelette accessible
Un squelette MUST être annoncé aux lecteurs d'écran comme un chargement en cours (zone marquée occupée, libellé « Chargement »). Son animation MUST être désactivée quand l'utilisateur demande moins d'animations.

#### Scenario: Lecteur d'écran
- **WHEN** un lecteur d'écran parcourt un écran en chargement
- **THEN** il annonce que le contenu est en cours de chargement

#### Scenario: Moins d'animations
- **WHEN** le système demande moins d'animations
- **THEN** le squelette s'affiche sans animation

### Requirement: Échec de chargement
Quand le chargement des données d'un écran échoue, l'écran MUST remplacer le squelette par un message d'erreur et une action « Réessayer ». Hors ligne, l'écran MUST utiliser les données en cache s'il y en a, sinon dire qu'il faut être en ligne.

#### Scenario: Erreur serveur
- **WHEN** le chargement de l'historique de prix échoue sur l'écran investissement
- **THEN** l'écran affiche un message d'erreur et un bouton « Réessayer » au lieu d'un squelette infini
