## ADDED Requirements

### Requirement: Affichage immédiat du haut de l'accueil
Sur la page d'accueil des visiteurs, le sur-titre, le titre principal, l'accroche et les boutons du haut de page MUST être lisibles dès le premier affichage du HTML rendu par le serveur, sans attendre le JavaScript, et ne MUST jamais être masqués (opacité nulle, découpe totale) au départ. Leur animation d'entrée MAY les déplacer jusqu'à leur place, sans les rendre invisibles.

#### Scenario: JavaScript désactivé ou lent
- **WHEN** un visiteur ouvre l'accueil et que le JavaScript n'est pas encore exécuté (ou est désactivé)
- **THEN** le titre principal et l'accroche sont visibles et lisibles à leur place finale, au plus tard à la fin de leur animation d'entrée

#### Scenario: Premier affichage
- **WHEN** le navigateur peint la page pour la première fois
- **THEN** le titre principal fait partie de ce premier affichage, avec une opacité non nulle

### Requirement: Animations de l'accueil indépendantes du chargement du JavaScript
Les animations d'arrivée du haut de l'accueil (entrée des textes, donne de l'éventail de cartes et son glitch final) MUST démarrer au premier affichage, sans dépendre du JavaScript. L'arrivée du JavaScript MUST NOT modifier ce qui est affiché, et le contenu du HTML serveur MUST rester complet et en place, y compris sans JavaScript.

#### Scenario: Pas de code d'autres écrans
- **WHEN** un visiteur charge l'accueil
- **THEN** aucune bibliothèque propre à un autre écran (génération de QR code des tournois) n'est téléchargée

#### Scenario: Donne de l'éventail sans JavaScript
- **WHEN** un visiteur ouvre l'accueil avec le JavaScript désactivé
- **THEN** les cartes de l'éventail sont distribuées puis restent posées en éventail

#### Scenario: Arrivée du JavaScript pendant la donne
- **WHEN** le JavaScript de l'éventail s'exécute pendant la donne
- **THEN** la donne continue sans saut ni redémarrage, et le survol des cartes n'est actif qu'une fois la donne finie

#### Scenario: Interactions après chargement
- **WHEN** le JavaScript de la page est chargé
- **THEN** le survol et le clic sur une carte de l'éventail, le carrousel des modules, les onglets Tournois / Boutiques et les apparitions au défilement fonctionnent comme avant

### Requirement: Préférence « réduire les animations » sur l'accueil
Si le visiteur préfère réduire les animations, l'accueil MUST s'afficher sans animation d'entrée, sans donne (éventail ouvert d'emblée), sans glitch automatique et sans apparition au défilement.

#### Scenario: Mouvement réduit
- **WHEN** un visiteur avec `prefers-reduced-motion: reduce` ouvre l'accueil
- **THEN** tous les textes et l'éventail ouvert sont affichés immédiatement à leur place, sans mouvement
