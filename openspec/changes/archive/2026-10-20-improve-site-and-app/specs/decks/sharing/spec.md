## ADDED Requirements

### Requirement: Lien de partage d'un deck
Le propriétaire d'un deck MUST pouvoir créer un lien de partage en lecture seule pour ce deck. Le lien MUST contenir un jeton aléatoire impossible à deviner, et non l'identifiant du deck. Un deck a au plus un lien actif. Demander un lien pour un deck déjà partagé MUST renvoyer le lien existant.

#### Scenario: Création
- **WHEN** le propriétaire choisit « Partager » sur un deck non partagé
- **THEN** un lien `/deck/<jeton>` est créé et peut être copié

#### Scenario: Deck d'un autre compte
- **WHEN** un utilisateur demande le lien de partage d'un deck qui ne lui appartient pas
- **THEN** la requête est refusée comme si le deck n'existait pas

### Requirement: Renouvellement et révocation
Le propriétaire MUST pouvoir renouveler le lien (un nouveau jeton remplace l'ancien) et le révoquer. Un lien renouvelé ou révoqué MUST cesser de fonctionner immédiatement. Supprimer le deck MUST révoquer son lien.

#### Scenario: Révocation
- **WHEN** le propriétaire révoque le lien puis qu'un visiteur ouvre l'ancienne adresse
- **THEN** le visiteur obtient une page 404

#### Scenario: Deck supprimé
- **WHEN** le propriétaire supprime un deck partagé
- **THEN** son lien renvoie une page 404

### Requirement: Page publique du deck
La page d'un lien actif MUST être consultable sans compte, dans la langue de l'adresse, et montrer : le nom du deck, le nom d'affichage du propriétaire, les Legends puis les autres cartes avec leurs quantités, groupées par type, la validité du deck (légal, ou liste des problèmes), le nombre total de cartes et le prix indicatif du deck complet. Elle MUST permettre de copier la liste texte du deck dans le même format que l'export existant. Elle MUST être rendue côté serveur et refléter l'état actuel du deck.

#### Scenario: Visiteur sans compte
- **WHEN** un visiteur non connecté ouvre un lien de deck actif
- **THEN** il voit la liste du deck et sa validité, sans écran de connexion

#### Scenario: Deck modifié
- **WHEN** le propriétaire ajoute une carte au deck après avoir partagé le lien
- **THEN** la page du lien montre la carte ajoutée au prochain chargement

### Requirement: Confidentialité de la page partagée
La page MUST ne révéler ni l'adresse e-mail du propriétaire, ni les notes du deck, ni le contenu de sa collection. Elle MUST être exclue de l'indexation des moteurs de recherche. Elle MUST fournir un titre et une image d'aperçu pour les aperçus de lien (messageries, réseaux sociaux).

#### Scenario: Données privées
- **WHEN** un visiteur ouvre la page d'un deck partagé
- **THEN** il ne voit ni e-mail, ni notes, ni indication de ce que possède le propriétaire

#### Scenario: Aperçu de lien
- **WHEN** le lien est collé dans une messagerie
- **THEN** l'aperçu affiche le nom du deck et une image

#### Scenario: Indexation
- **WHEN** un moteur de recherche explore la page
- **THEN** la page indique de ne pas être indexée

### Requirement: Importer un deck partagé
Un utilisateur connecté qui consulte un deck partagé MUST pouvoir le copier dans ses propres decks en un clic. La copie est un deck indépendant, et l'original n'est pas modifié. Un visiteur non connecté MUST être dirigé vers la connexion, puis revenir à la page.

#### Scenario: Copie
- **WHEN** un utilisateur connecté choisit « Copier dans mes decks »
- **THEN** un nouveau deck du même nom avec les mêmes cartes apparaît dans ses decks
