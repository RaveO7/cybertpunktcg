# Design

## Context

`GameCard` (utilisé uniquement par `DemoMatch`) agrandit la carte survolée en place (`hover ? "z-20 scale-110"`). Cette carte agrandie reste dans une chaîne de conteneurs qui coupent ce qui dépasse :

| Zone | Conteneurs qui rognent |
|---|---|
| Main | `.demo-match-hand` (`overflow: hidden`, `container-type: size`), la rangée de la main (`overflow-hidden`), `.demo-match-table` (`overflow-hidden`) |
| Field, Field rival | `.demo-match-card-row` (`overflow: hidden`), le bloc du Field rival (`overflow-hidden`), `.demo-match-table` |

En main, la carte fait `100cqh − 0.75rem` de haut. Avec `scale(1.1)` depuis le centre, elle dépasse d'environ 5 % en haut et en bas, plus le décalage de l'éventail (`translateY(|offset| × 2px)` et une rotation). C'est surtout son bas qui est coupé. Le z-index ne peut rien contre ce rognage.

D'autres calques fixes se superposent déjà, chacun avec son niveau : plateau plein écran sur téléphone (portail, z-60), carte en vol `.dm-ghost` (66), anneau et bulle du coach `CoachCallout` (70-73), fiche zoom de `GameCard` (portail, z-80).

Pour les animations de déplacement, `takeFlipSnapshot` copie le DOM de chaque `[data-flip]` au moment de l'action. Une carte encore survolée lors du clic est donc copiée dans l'état où elle se trouve.

## Goals / Non-Goals

**Goals :**
- Sortir la carte agrandie de tous les conteneurs qui la rognent, sans toucher à la mise en page du plateau.
- Garder le pointeur, le clic et l'appui long sur la carte d'origine, sans scintillement.

**Non-Goals :**
- Revoir les `overflow` et les tailles du plateau.
- Soulever la carte qui pulse (`scale-105`) quand elle n'est pas survolée.

## Decisions

### 1. Calque fixe en portail plutôt que retirer les `overflow: hidden`

La carte soulevée est rendue avec `createPortal` dans `document.body`, en `position: fixed`, `pointer-events: none`, comme la fiche zoom.

Alternatives écartées :
- **Retirer les `overflow: hidden` et monter le z-index de l'emplacement survolé.** Il y a trois niveaux à modifier. Chacun a une raison d'être : `.demo-match-table` contient la grille animée (`::before` avec `inset: 45% -20% -10%`) et le tremblement ; les rangées gardent l'éventail et le chevauchement dans la largeur sans barre de défilement. Le Field rival touche en plus le bord haut du plateau, donc le plateau rognerait encore.
- **Réserver une marge autour des cartes** (cartes plus petites, `transform-origin: bottom`). Cela réduit les cartes en permanence pour un effet de survol, et cela ne règle pas les bords du plateau.
- **`overflow: clip` avec `overflow-clip-margin`.** La prise en charge par les navigateurs est inégale (Safari), et il faudrait encore modifier les trois niveaux.

### 2. Carte soulevée droite, centrée sur la carte d'origine

Position : le centre du `getBoundingClientRect()` du bouton. Largeur : `offsetWidth × 1.1`, avec `offsetWidth` qui est la largeur de mise en page, non transformée. La carte n'est pas tournée. Une carte de l'éventail ou une carte dépensée (`rotate-6`) se redresse quand on la « prend en main », comme dans les jeux de cartes numériques. Reproduire la rotation demanderait de relire les transformations des parents ; c'est inutile.

### 3. Carte d'origine invisible, mais toujours active

Pendant le soulèvement, le visuel intérieur de la carte passe en `opacity: 0`. Le bouton garde sa taille et ses événements. `visibility: hidden` est écarté : le bouton ne recevrait plus le pointeur, ce qui déclencherait `pointerleave`, la fin du soulèvement, puis un nouveau `pointerenter`, en boucle. Le visuel (cadre, image, « spent », liseré pulse ou sélectionné, Gear attaché) est extrait dans un sous-composant local, rendu à la fois en place et dans le calque, pour que les deux restent identiques.

### 4. Niveau du calque : z-[65]

Au-dessus du plateau plein écran (60). En dessous de la carte en vol (66), du coach (70-73) et de la fiche zoom (80). La bulle du coach reste prioritaire, comme aujourd'hui.

### 5. Fiche zoom placée par rapport à la carte soulevée

`updatePos` calcule le rectangle de la carte soulevée (centre d'origine, largeur × 1.1, hauteur × 1.4), puis place la fiche autour de ce rectangle. La vraie hauteur mesurée de la fiche est conservée (`tipRef.offsetHeight`, `useLayoutEffect`, déjà dans la copie de travail). Un seul `updatePos` calcule les deux positions. Il est relancé au défilement et au redimensionnement, comme aujourd'hui.

### 6. Copies des animations de déplacement

L'invisibilité du visuel en place est portée par un attribut (`data-lifted`), pas par une classe utilitaire. Une règle CSS sous `.dm-ghost__face` rend la copie visible (`opacity: 1 !important`), comme les règles existantes de `.dm-ghost__face`. En plus, `onClick` met fin au soulèvement. Ce n'est pas suffisant seul, car la copie est prise avant le nouveau rendu.

### 7. Apparition et retour animés

La carte soulevée part de la pose de la carte en place : son inclinaison (rotation du bouton et de ses parents, éventail de la main ou carte couchée, lue sur les styles calculés) et sa taille (`1 / 1.1`), passées en variables CSS. Elle se redresse et grandit en ≈ 260 ms avec une courbe douce. En fin de survol, la fiche zoom disparaît tout de suite, et la carte redescend vers cette pose en ≈ 180 ms avant d'être retirée ; la carte en place reste invisible jusque-là. Si le pointeur revient pendant la redescente, la carte remonte. Au clic, et sous `prefers-reduced-motion`, il n'y a pas de retour animé : le calque est retiré immédiatement, et les deux animations sont coupées dans le bloc existant des animations `dm-*`.

## Risks / Trade-offs

- [La carte d'origine bouge pendant le soulèvement (glissement d'éventail après une action, tremblement du plateau)] → le calque ne suit pas pendant l'animation. Comme le soulèvement s'arrête au clic, le cas reste rare et court. On ne fait pas de suivi image par image.
- [Le calque est plus grand que le bouton et ne capte pas le pointeur] → le survol continue tant que le pointeur reste sur la carte d'origine, ce qui correspond à son ancienne taille. C'est le même comportement qu'avec `scale-110` aujourd'hui.
- [La bulle du coach (z-73) peut cacher une partie de la carte soulevée] → c'est voulu : le guidage reste prioritaire, comme avant.
- [Une transformation sur un parent change le repère d'un `position: fixed`] → le portail vers `document.body` évite ce problème, contrairement à un calque rendu dans le plateau, qui est transformé pendant le tremblement.
