# Tasks

## 1. Calcul des positions

- [x] 1.1 Extraire dans un module pur (`src/components/card-lift.ts`) le calcul du rectangle de la carte soulevée (centre du bouton, largeur de mise en page × 1.1, ratio 1.4) et le placement de la fiche zoom autour de ce rectangle (au-dessus, sinon en dessous, sinon à côté, puis limité à l'écran avec 8 px de marge), à partir de la hauteur réelle de la fiche. Vérification : `npm run typecheck` passe.
- [x] 1.2 Ajouter `tests/unit/card-lift.test.ts` : fiche au-dessus quand la place suffit ; en dessous près du haut ; à côté quand ni l'un ni l'autre ne tient ; jamais de chevauchement avec la carte soulevée dans ces trois cas ; une fiche plus haute que l'estimation (texte long) reste hors de la carte. Vérification : `npm run test:unit -- card-lift` passe.

## 2. Carte soulevée dans GameCard

- [x] 2.1 Extraire le visuel de la carte (cadre, image ou dos, « spent », liseré pulse ou sélectionné, Gear attaché) dans un sous-composant local de `src/components/GameCard.tsx`, rendu en place sans changement visible. Vérification : le tutoriel s'affiche comme avant, avec un Gear équipé et une carte dépensée.
- [x] 2.2 Supprimer `z-20 scale-110` au survol. Pendant le survol ou l'appui long, rendre le visuel en portail dans `document.body` (`position: fixed`, `z-[65]`, `pointer-events: none`, droit, au rectangle de la tâche 1.1), et passer le visuel en place en `opacity: 0` via `data-lifted`, en gardant la taille du bouton. Vérification : survoler une carte de la main en bas du plateau la montre entière, y compris son bord inférieur, sans coin de la carte inclinée visible derrière ; survoler le Field rival montre son bord supérieur.
- [x] 2.3 Placer la fiche zoom avec la fonction de la tâche 1.1 (un seul `updatePos` pour la carte et la fiche, recalculé avant l'affichage, au défilement et au redimensionnement), en gardant la mesure de hauteur réelle déjà présente dans la copie de travail. Vérification : en allemand, la fiche de Jackie Welles ne recouvre plus la carte soulevée.
- [x] 2.4 Mettre fin au soulèvement dans `onClick` avant l'action. Vérification : un clic sur la carte attendue déclenche l'étape suivante du tutoriel et la carte soulevée disparaît.
- [x] 2.5 Vérifier que le pointeur sur la carte d'origine ne fait pas clignoter le soulèvement (aucun `pointerleave` provoqué par le calque) et qu'un appui long au doigt soulève la carte puis la relâche au lever du doigt. Vérification : test manuel à la souris et en mode tactile des outils de développement.

## 3. Styles et animations

- [x] 3.1 Dans `src/app/globals.css`, animer le calque soulevé depuis la pose de la carte en place (inclinaison et taille, ≈ 260 ms, courbe douce) et l'y faire redescendre en fin de survol (≈ 180 ms) avant de le retirer ; couper les deux animations dans le bloc `prefers-reduced-motion` des animations `dm-*`. Vérification : la carte part inclinée puis se redresse, redescend à la sortie du pointeur, remonte si le pointeur revient ; avec « réduire les animations » émulé, elle apparaît et disparaît sans animation.
- [x] 3.2 Ajouter sous `.dm-ghost__face` une règle qui rend visible un visuel `[data-lifted]` copié (`opacity: 1 !important`). Vérification : cliquer sur une carte de la main pendant le survol (vente → Eddies, jeu → Field, Trash) la montre visible pendant tout le vol.

## 4. Vérification d'ensemble

- [x] 4.1 Parcourir le tutoriel en entier sur ordinateur (fenêtre large et fenêtre basse) et en plein écran téléphone (portrait et paysage, outils de développement) : survol de la main, du Field, du Field rival, d'une Unit équipée, d'une carte dépensée, d'une carte face cachée (aucun soulèvement), près du haut et du bas de l'écran. Vérification : aucune carte soulevée coupée, aucune fiche qui la recouvre, aucune régression des animations.
- [x] 4.2 Lancer `npm run typecheck`, `npm run lint` et `npm run test:unit`. Vérification : tout passe.

## Workflow follow-up

- Archiver le change après validation par l'utilisateur (`/opsx:archive`).
