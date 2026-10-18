# Proposal

## Why

Dans le tutoriel jouable (`DemoMatch`), une carte survolée grossit de 10 % (`scale-110`), mais son bas (et parfois son haut) disparaît sous le bord du plateau : elle semble « passer derrière le tapis ». Ce n'est pas un problème de z-index. La carte agrandie reste dans des conteneurs qui coupent tout ce qui dépasse (`overflow: hidden`) : la zone de la main `.demo-match-hand`, la rangée de la main, la rangée Field ou Rival `.demo-match-card-row`, et le plateau `.demo-match-table` lui-même. Aucun z-index ne peut faire sortir un élément d'un conteneur qui le rogne. En main, la carte occupe déjà toute la hauteur disponible (`--dm-card-hand` ≈ `100cqh − 0.75rem`), donc le moindre agrandissement est coupé. Les deux corrections rapides tentées (z-index sur l'emplacement survolé, puis repositionnement de la fiche zoom) n'ont pas réglé ce point.

## What Changes

- Au survol à la souris (ou à l'appui long au doigt), la carte du tutoriel est **soulevée** : une copie agrandie et redressée s'affiche dans un calque fixe au-dessus du plateau, à la place de la carte, et n'est plus coupée par aucun conteneur. La carte d'origine reste en place, invisible, et continue de recevoir le pointeur et le clic.
- L'agrandissement en place (`scale-110` / `z-20` au survol) est supprimé, puisque c'est lui qui est rogné.
- La fiche zoom (image + nom + description) se place par rapport à la carte soulevée, sans la recouvrir. Elle garde le calcul de sa vraie hauteur, déjà présent dans la copie de travail (un texte long, en allemand par exemple, la rendait plus haute que prévu).
- Une carte encore soulevée au moment du clic s'anime normalement vers sa nouvelle zone : la copie qui vole ne doit pas hériter de l'état invisible.

**Hors périmètre** : la carte attendue qui pulse sans être survolée (`scale-105`) reste agrandie en place et peut encore être légèrement rognée ; les écrans hors tutoriel (`GameCard` n'est utilisé que par `DemoMatch`) ; une refonte des tailles et des marges du plateau.

## Capabilities

### New Capabilities
- `tutorial/card-inspection` : façon dont le joueur examine une carte dans le tutoriel jouable (soulèvement au survol ou à l'appui long, fiche zoom, superposition au-dessus du plateau).

### Modified Capabilities
<!-- Aucune : aucune spec existante ne couvre le tutoriel jouable. -->

## Impact

- `src/components/GameCard.tsx` : survol, calque soulevé en portail, placement de la fiche zoom.
- `src/app/globals.css` : style et apparition du calque soulevé ; règle pour que la copie en vol (`.dm-ghost__face`) reste visible.
- `src/components/DemoMatch.tsx` et `src/components/demo-card-moves.ts` : pas de changement de logique attendu, seulement à vérifier (les copies des animations de déplacement sont faites à partir du DOM des cartes).
- Pas d'API, de base de données ni de dépendance touchées.
