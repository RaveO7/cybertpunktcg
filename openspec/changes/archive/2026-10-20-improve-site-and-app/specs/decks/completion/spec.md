## ADDED Requirements

### Requirement: Cartes manquantes d'un deck
Pour chaque deck, l'application MUST afficher, en comparant le deck à la collection de l'utilisateur, le nombre d'exemplaires possédés sur le total, la liste des cartes manquantes avec leur quantité manquante, et le coût des manquantes calculé au prix de marché du tirage le moins cher de chaque carte. Tous les tirages d'une carte comptent comme possession. Une carte sans aucun prix MUST être signalée « sans prix » et exclue du coût.

#### Scenario: Deck incomplet
- **WHEN** un deck demande 3 exemplaires d'une carte et que la collection en contient 1, tous tirages confondus
- **THEN** la carte apparaît dans les manquantes avec « ×2 » et son coût est 2 fois le prix du tirage le moins cher

#### Scenario: Deck complet
- **WHEN** la collection contient tous les exemplaires du deck
- **THEN** l'application indique que le deck est complet et n'affiche aucun coût manquant

### Requirement: Ajout des manquantes à la liste de souhaits
L'écran d'un deck incomplet MUST proposer une action qui ajoute à la liste de souhaits, en une seule opération, le tirage le moins cher de chaque carte manquante, ou le premier tirage de la carte si aucun n'a de prix. Un tirage déjà présent dans la liste de souhaits MUST être conservé tel quel, avec son prix cible et ses notes. Après l'action, l'application MUST indiquer combien de cartes ont été ajoutées et combien y étaient déjà.

#### Scenario: Ajout en un clic
- **WHEN** un deck a 4 cartes manquantes, dont une déjà dans la liste de souhaits, et que l'utilisateur lance l'action
- **THEN** 3 tirages sont ajoutés à la liste de souhaits et l'application affiche « 3 ajoutées, 1 déjà présente »

#### Scenario: Cible existante préservée
- **WHEN** le tirage le moins cher d'une carte manquante est déjà dans la liste de souhaits avec un prix cible
- **THEN** son prix cible et ses notes ne changent pas

#### Scenario: Échec
- **WHEN** l'ajout échoue (réseau, session expirée)
- **THEN** aucune ligne n'est ajoutée partiellement et un message d'erreur s'affiche

### Requirement: État de complétion dans la liste des decks
Chaque deck de la liste des decks MUST afficher son état de complétion : « complet » ou le nombre d'exemplaires manquants.

#### Scenario: Liste des decks
- **WHEN** l'utilisateur ouvre la liste de ses decks
- **THEN** chaque deck montre « complet » ou « N manquantes »
