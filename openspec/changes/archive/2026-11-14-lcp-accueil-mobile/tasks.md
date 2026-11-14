# Tâches

## 1. Référence

- [x] 1.1 Captures « avant » visiteur de `fr`, desktop et mobile (`CAPTURE_SIGNED_OUT=1 CAPTURE_PATHS=fr`, `desktop-chrome` + `pixel`), copiées dans le scratchpad. Vérification : les fichiers existent.
- [x] 1.2 Lighthouse mobile de référence sur un build de production local (`/fr`) et sur la prod. Vérification : local 73 / LCP 5,4 s ; prod 36 / LCP 7,6 s / TBT 8 s.

## 2. Haut de page affiché tout de suite

- [x] 2.1 `cp-intro-up` / `cp-intro-left` sans opacité, seulement le glissé. Vérification : LCP observé = FCP sur 5 passages Lighthouse locaux ; e2e « sans JavaScript » (opacité effective 1 dès le départ), qui échoue si on remet le fondu.
- [x] 2.2 Donne de l'éventail en CSS : place finale rendue par le serveur, position de départ et délai par carte, glitch final sur une enveloppe, phase `open` à la fin des animations. Vérification : e2e sans JS (cartes posées et visibles), avec JS (fiche ouverte au clic après la donne), mouvement réduit (aucune animation) ; planches d'images avant/après de l'arrivée.

## 3. JavaScript au démarrage

- [x] 3.1 Hydratation différée des îlots essayée puis écartée (contenu sorti du flux et masqué sans JS, gain non mesurable). Vérification : HTML local sans bloc `hidden id="S:…"`.
- [x] 3.2 `QrCode` sorti de `tournament/ui.tsx` dans `tournament/QrCode.tsx`. Vérification : aucun morceau JS de `/fr` ne contient la bibliothèque `qrcode` ; typecheck vert.

## 4. Vérifications

- [x] 4.1 Test e2e `tests/e2e/landing.spec.ts` (donne sans JS, survol inactif pendant la donne, fiche, carrousel, onglets, mouvement réduit, pas de `qrcode`). Vérification : 6 réussis sur `desktop-chrome` + `pixel` ; échec constaté en remettant le fondu ou en retirant le blocage du survol.
- [x] 4.2 `npm run check` vert ; e2e « QR personnel » (`features2.spec.ts`) vert après le déplacement de `QrCode`.
- [x] 4.3 Captures « après » visiteur de `fr`, desktop et mobile, et planches de l'arrivée (0,4 à 3,5 s) comparées à la prod. Vérification : état final identique ; texte visible dès la première image.

## Workflow follow-up

- Preview Vercel, puis `/perf-prod --url <preview> --only accueil --public-only --label "LCP accueil"` : objectif LH perf mobile ≥ 85.
- Commits (`commit-pr`), livraison (`livrer`).
