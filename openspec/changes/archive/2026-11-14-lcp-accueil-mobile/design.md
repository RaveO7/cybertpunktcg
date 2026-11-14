# Design : affichage immédiat du haut de l'accueil

## Context

Mesures de départ (prod, `/fr`, mobile, Lighthouse en 4G simulée et CPU ×4, 2026-11-14) :

- score 36, FCP 1,4 s, LCP 7,6 s, TBT 8,0 s, Speed Index 13,5 s ;
- découpage du LCP : TTFB 0,18 s, puis **délai de rendu de l'élément 8,0 s** (h1, aucune ressource à attendre) ;
- trace observée : premier changement visuel à 0,28 s, mais FCP et LCP observés à 6,9 et 8,2 s.

Le haut de page (`data-intro`) joue en CSS l'animation `cp-intro-up` / `cp-intro-left`, qui part de `opacity: 0`. Chrome ignore un élément d'opacité nulle pour le FCP et le LCP. Quand l'opacité monte dans une animation du compositeur, l'affichage n'est attribué qu'au rendu suivant du thread principal. Or celui-ci est occupé par l'évaluation des scripts et l'hydratation de toute la page (shell compris). D'où ces secondes de délai, alors que le texte est visible à l'œil bien plus tôt.

L'éventail (`HeroCardFan`) est rendu côté serveur en phase `stacked` : cartes à opacité 0 sous l'éventail. La donne ne démarre qu'après l'hydratation, 250 ms plus tard, à l'aide de minuteurs.

## Goals / Non-Goals

**Goals :**
- Texte du haut de page compté au premier affichage. LCP mobile ≈ FCP.
- Donne de l'éventail indépendante du JavaScript, identique à l'œil.
- Moins de JS au démarrage de l'accueil : pas de code propre à d'autres écrans.
- Score Lighthouse mobile ≥ 85 sur la preview (`/perf-prod --only accueil`).

**Non-Goals :**
- Shell commun (`SiteShell`, providers, `AppFrame`) : partagé par toutes les pages, hors périmètre. Ses coûts sont mesurés et signalés seulement.
- Pas de changement du contenu, des textes, de l'ordre des sections, ni du HTML indexable.

## Decisions

### 1. Entrée du haut de page : glissé sans fondu
`cp-intro-up` et `cp-intro-left` ne portent plus que `transform` (24 px vers le haut, 40 px depuis la gauche), avec la même courbe, la même durée et les mêmes `--reveal-delay`. Le texte est opaque dès la première image (décision utilisateur du 2026-11-14). Le glitch d'arrivée lancé par `RevealDirector` reste inchangé.
*Rejeté :* un fondu partant de 25 % d'opacité (texte estompé au départ) ; un départ à opacité 0,01 (contournement de la règle de Chrome, contraire à « jamais masqué »).

### 2. Donne de l'éventail en CSS
Le serveur rend directement les cartes à leur place dans l'éventail (variables `--fan-*`). Chaque carte reçoit aussi sa position de départ (`--deal-x`, `--deal-r`), son rang et le décalage `250 ms + rang × 120 ms`. Deux animations en `animation-fill-mode: backwards` jouent la donne : déplacement (0,9 s, `cubic-bezier(0.18, 1.25, 0.4, 1)`) et apparition (0,25 s). Pendant le délai, la position de départ s'applique. À la fin, la carte revient à son style normal, celui de l'éventail. Les transitions du survol fonctionnent alors comme avant. Le glitch de fin de donne est une animation CSS (`cp-glitch-block`), retardée de `250 + 900 + 120 × (n − 1)` ms, sur une enveloppe de la liste. Il ne se rejoue pas quand `GlitchDirector` pose et retire `.is-glitching` sur la liste elle-même.
Côté JS, la phase passe de `dealing` à `open` quand les animations de la liste sont finies (`getAnimations({ subtree: true })` puis `finished`). L'arrivée du JS pendant la donne ne la relance pas. Le survol n'est actif qu'après la donne. Avec mouvement réduit, aucune animation n'est déclarée (`@media (prefers-reduced-motion: no-preference)`), donc la phase est `open` tout de suite.
*Rejeté :* garder les minuteurs JS. La donne attendrait le chargement différé du script, et les cartes resteraient invisibles jusque-là.

### 3. Hydratation différée des îlots : essayée, écartée
J'ai essayé d'hydrater l'éventail, le carrousel, les onglets et annuaires, ainsi que `GlitchDirector`, une fois le navigateur au repos. Le principe : une frontière `<Suspense>` qui attend `whenIdle` côté navigateur, d'abord avec `React.lazy`, puis avec `use()` sur une promesse de repos. Les deux variantes ont été mesurées sur un build de production local, et j'ai abandonné l'approche pour deux raisons :

- **Contenu masqué sans JavaScript.** React sort du flux principal une frontière Suspense au contenu volumineux, même terminée (`progressiveChunkSize`). Le contenu de ces frontières est alors placé dans un bloc `hidden` (`<div hidden id="S:0">`), puis remis en place par un script inline. Sans JavaScript, il reste invisible. Placer la frontière dans la page serveur ou dans le composant client ne change rien.
- **Aucun gain mesurable.** Sur 5 passages Lighthouse mobile, LCP 4,5 s contre 4,7 s sans l'hydratation différée, dans le bruit. Le TBT local était déjà de 150 à 300 ms.

*Rejeté aussi :* `next/dynamic`.
- Avec `ssr: true`, il hydrate dès l'arrivée du morceau, qui est préchargé.
- Avec `ssr: false`, le contenu disparaît du HTML serveur.

### 3 bis. Bibliothèque de QR code hors de l'accueil
`src/components/tournament/ui.tsx` regroupe les classes de boutons et champs, ainsi que le composant `QrCode`, qui importe `qrcode`. Les annuaires de l'accueil importent ces classes et embarquaient donc `qrcode`, soit un morceau de 31 Ko chargé au démarrage. `QrCode` passe dans son propre fichier, `tournament/QrCode.tsx`, importé seulement par `PlayersTab`.

### 4. Mesure en local avant la preview
Build de production local (`next build` + `next start`) et Lighthouse mobile (même CLI et même Chromium que `scripts/perf/lighthouse.ts`), avant puis après chaque étape. On garde seulement ce qui fait baisser le LCP ou le TBT. La preview et `/perf-prod` servent de mesure finale.

## Risks / Trade-offs

- [Le glitch de fin de donne ne se déclenche plus par classe] → il est rejoué uniquement par l'animation CSS initiale. Les glitchs aléatoires de `GlitchDirector` restent sur la liste.
- [Le score ≥ 85 n'est pas atteint à cause du shell commun, hors périmètre] → les coûts restants sont mesurés et signalés avec des pistes. Le shell n'est pas modifié dans ce change.
- [Mesure locale peu représentative] → en local, sans latence, les scripts s'exécutent avant la première image. Le modèle de Lighthouse compte alors tout le JS dans le LCP (LCP simulé ≈ 4,5 s alors que le LCP observé égale le FCP). La mesure qui fait foi est celle de la preview.

## Migration Plan

Aucune donnée. Retour arrière = revert du commit.
