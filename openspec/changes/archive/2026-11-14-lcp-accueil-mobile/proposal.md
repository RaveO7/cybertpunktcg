# Proposition : affichage immédiat du haut de l'accueil (LCP mobile)

## Why

Sur `/fr` en mobile (visiteur), Lighthouse mesure un LCP de 7,1 à 7,6 s en 4G simulée et un score de performance de 36. L'élément LCP est le titre principal. Il démarre à opacité 0 (fondu d'entrée en CSS) : Chrome ne compte son affichage qu'au rendu suivant du thread principal, et celui-ci est bloqué par l'hydratation de toute la page. En prod, le premier changement visuel arrive à 0,3 s mais le FCP observé à 6,9 s. Les cartes de l'éventail restent aussi invisibles tant que leur JavaScript n'est pas exécuté.

## What Changes

- Haut de l'accueil (sur-titre, titre, accroche, boutons) : lisible dès le premier affichage du HTML serveur. L'entrée garde son glissé (mêmes distances, courbe et décalages), sans fondu depuis l'opacité 0. Le glitch d'arrivée est conservé.
- Éventail de Légendes : la donne (vol depuis le bas, puis glitch final) est jouée en CSS dès le premier affichage. Elle ne dépend plus du JavaScript. Le survol, l'inclinaison et la fiche au clic arrivent avec le JavaScript, sans rien changer à l'écran.
- Le premier affichage ne dépend plus du JavaScript. Le JS de l'accueil perd la bibliothèque de QR code des tournois (≈ 31 Ko), chargée jusqu'ici par les annuaires via `tournament/ui.tsx`. L'hydratation différée des îlots a été essayée puis écartée (voir design.md, décision 3).
- « Réduire les animations » : aucune animation d'entrée ni donne ; l'éventail est ouvert d'emblée, comme aujourd'hui.
- Rendu final et animations identiques à l'œil, à une exception près : le fondu d'entrée du haut de page disparaît (décision du 2026-11-14).

## Capabilities

### New Capabilities
<!-- aucune -->

### Modified Capabilities
- `site/landing` : exigence d'affichage immédiat du haut de la page d'accueil et de chargement différé des animations.

## Impact

- `src/components/public-site/HeroCardFan.tsx` (donne en CSS).
- `src/components/tournament/ui.tsx` → `QrCode` déplacé dans `src/components/tournament/QrCode.tsx`.
- `src/app/globals.css` : animations `data-intro` et donne de l'éventail.
- Aucun changement d'API, de base, de schéma ni de traduction.
- Mesure : `/perf-prod --only accueil --public-only` sur une preview. Objectif : score Lighthouse mobile ≥ 85.
