# Tasks

## 1. Appareils ordinateur dans Playwright

- [x] 1.1 Ajouter les projets `desktop-chrome` (`devices["Desktop Chrome"]`) et `desktop-safari` (`devices["Desktop Safari"]`) dans `playwright.config.ts`, à la suite de `iphone` et `pixel` ; mettre à jour le commentaire d'en-tête (téléphones **et** ordinateurs). Vérifier avec `npx playwright test --list` que chaque test apparaît sur les quatre projets.
- [x] 1.2 Ajouter dans `package.json` les scripts `test:e2e:desktop` (`playwright test --project=desktop-chrome --project=desktop-safari`) et `test:e2e:mobile` (`--project=iphone --project=pixel`). Vérifier avec `npm run test:e2e:desktop -- --list` et `npm run test:e2e:mobile -- --list` que seuls les bons projets sont listés.

## 2. Gardes « téléphone seulement »

- [x] 2.1 `keyboard.spec.ts` : `test.skip(!isMobile, "clavier virtuel et tap : téléphone seulement")`. Vérifier avec `npm run test:e2e -- keyboard` : passé sur `iphone`/`pixel`, ignoré avec sa raison sur les deux projets ordinateur.
- [x] 2.2 `tutorial.spec.ts` : extraire la vérification du calque soulevé (visible, animations finies, dans le viewport, aucun ancêtre qui rogne) dans une fonction locale ; garder le test d'appui long avec `test.skip(!isMobile, "appui long au doigt : téléphone seulement")`. Vérifier avec `npm run test:e2e:mobile -- tutorial` qu'il passe toujours.

## 3. Équivalents ordinateur

- [x] 3.1 `tutorial.spec.ts` : nouveau test « survol à la souris d'une carte de la main », `test.skip(isMobile, …)` : `card.hover()`, même vérification via la fonction de 2.2, capture `tutoriel-carte-survolee`, puis `page.mouse.move(0, 0)` et `.dm-lift` disparaît. Vérifier avec `npm run test:e2e:desktop -- tutorial` sur Chrome et Safari desktop.
- [x] 3.2 `features.spec.ts` : renommer le test « barre de navigation du bas » en « barre de navigation : chaque onglet ouvre son écran », le laisser tourner partout, et vérifier en plus que la barre « Sections » visible est dans le `<header>` sur ordinateur et hors du `<header>` sur téléphone. Mettre à jour le commentaire d'en-tête du fichier (« Parcours fonctionnels sur téléphone » → tous appareils). Vérifier avec `npm run test:e2e -- -g "barre de navigation"` sur les quatre projets.
- [x] 3.3 `features2.spec.ts` « préférences : tri par défaut et filtres du catalogue » : sur téléphone, garder l'ouverture du tiroir « Filtres » ; sur ordinateur, vérifier que les contrôles de filtre sont visibles sans clic (colonne `lg:`). Vérifier avec `npm run test:e2e -- -g "préférences"` sur les quatre projets.
- [x] 3.4 `sweep.spec.ts` : mettre à jour le commentaire (« sur téléphone » → tous appareils) et confirmer que les filtres de bruit WebKit couvrent Safari desktop. Vérifier avec `npm run test:e2e:desktop -- sweep` : aucune erreur JS, requête en échec ni débordement horizontal, ou bilan des pages fautives.

## 4. Campagne globale ordinateur + téléphone

- [x] 4.1 Lancer la campagne complète dans l'ordre, chaque étape même si la précédente échoue : `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (avec `DATABASE_URL` en `file:...`). Vérifier que les captures existent dans `tests/e2e/screenshots/{iphone,pixel,desktop-chrome,desktop-safari}/`.
- [x] 4.2 Relancer `npm run test:e2e` une seconde fois, avec `next dev` déjà lancé sur le port 3000 (reprend la tâche 4.1 de `add-mobile-e2e-tests`). Vérifier que le résultat est identique et qu'aucun compte `e2e.*@example.com` ni compteur du limiteur `:e2e-*` ne reste en base après les deux runs.
- [x] 4.3 Rédiger le bilan pour l'utilisateur : par appareil, tests passés / ignorés (avec raison) / en échec, et pour chaque échec la cause probable et la trace. Corriger dans ce change les échecs triviaux de test ; pour un vrai bug de l'application, le décrire et proposer un change dédié sans masquer le test. Cocher quand le bilan est remis.

## Workflow follow-up

- Cocher la tâche 4.1 de `add-mobile-e2e-tests` une fois 4.2 validée, puis archiver les deux changes.
