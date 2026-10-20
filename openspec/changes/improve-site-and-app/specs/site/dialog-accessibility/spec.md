## ADDED Requirements

### Requirement: Focus dans les fenêtres modales
Chaque fenêtre modale ou feuille de l'application et du site (fiche carte, ajout rapide, tiroir de filtres, confirmations, fenêtres des decks, tutoriel, aperçu de carte de l'accueil) MUST :
- être exposée comme boîte de dialogue modale avec un nom accessible ;
- placer le focus sur un élément à l'intérieur à l'ouverture ;
- garder le focus à l'intérieur tant qu'elle est ouverte (Tab et Maj+Tab bouclent) ;
- rendre le contenu en arrière-plan inerte, sauf la barre de navigation du bas ;
- empêcher le défilement de la page en arrière-plan.

#### Scenario: Tabulation bouclée
- **WHEN** la fiche carte est ouverte et que l'utilisateur appuie sur Tab depuis son dernier élément
- **THEN** le focus revient au premier élément de la fiche, pas à la page derrière

#### Scenario: Arrière-plan inerte
- **WHEN** la feuille d'ajout rapide est ouverte
- **THEN** les éléments de la page derrière ne peuvent recevoir ni le focus ni un clic

#### Scenario: Barre du bas sous une fenêtre
- **WHEN** la fiche d'une carte est ouverte sur téléphone et que l'utilisateur touche « Decks » dans la barre du bas
- **THEN** l'écran des decks s'ouvre directement et la fiche est fermée

### Requirement: Fermeture et retour du focus
Chaque fenêtre modale MUST se fermer avec la touche Échap, sauf pendant un enregistrement en cours. À la fermeture, le focus MUST revenir à l'élément qui l'a ouverte, s'il existe encore. Quand des fenêtres sont empilées, Échap MUST fermer seulement la plus haute.

#### Scenario: Retour du focus
- **WHEN** l'utilisateur ouvre la fiche d'une carte au clavier puis appuie sur Échap
- **THEN** la fiche se ferme et le focus revient sur la tuile de cette carte

#### Scenario: Fenêtres empilées
- **WHEN** une confirmation est ouverte par-dessus la fenêtre d'un deck et que l'utilisateur appuie sur Échap
- **THEN** seule la confirmation se ferme

### Requirement: Sélection multiple au clavier
La sélection multiple de cartes dans l'explorateur, faite à la souris par Ctrl+glisser, MUST avoir un équivalent clavier. Il permet d'entrer en mode sélection, de cocher et décocher la carte qui a le focus (Espace), de se déplacer entre les cartes avec les flèches, d'étendre la sélection avec Maj+flèches et de quitter le mode avec Échap. Le nombre de cartes sélectionnées MUST être annoncé aux lecteurs d'écran.

#### Scenario: Sélection au clavier
- **WHEN** l'utilisateur entre en mode sélection, coche une carte avec Espace puis en coche deux autres avec Maj+Flèche droite
- **THEN** trois cartes sont sélectionnées et « 3 cartes sélectionnées » est annoncé

#### Scenario: Sortie du mode
- **WHEN** l'utilisateur appuie sur Échap en mode sélection, sans fenêtre ouverte
- **THEN** le mode sélection se termine
