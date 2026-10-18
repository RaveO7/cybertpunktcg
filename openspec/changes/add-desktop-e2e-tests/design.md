# Design

## Context

`playwright.config.ts` déclare deux projets (`iphone` = `devices["iPhone 15"]`, `pixel` = `devices["Pixel 7"]`), un serveur `next dev` dédié (port 3100, `.next-e2e`), une exécution en série (`workers: 1`) et la garde SQLite. Les fixtures (`tests/e2e/fixtures.ts`) suffixent les e-mails et rangent les captures par `testInfo.project.name` : un nouveau projet n'y demande aucun changement.

Points des specs qui supposent un téléphone :

- `tutorial.spec.ts` simule un appui long en `pointerdown` avec `pointerType: "touch"`. Sur ordinateur, `GameCard` soulève la carte sur `pointerenter` souris et ignore le `pointerdown` souris.
- `keyboard.spec.ts` utilise `locator.tap()`, qui exige `hasTouch` et lève une erreur sinon.
- `features.spec.ts` « barre de navigation du bas » : la `<nav aria-label="Sections">` du bas est `sm:hidden`. Sur ordinateur, celle de l'en-tête porte le même nom accessible (`hidden sm:flex`) : le sélecteur trouve donc la bonne barre selon l'écran.
- `features2.spec.ts` « préférences : tri par défaut et filtres du catalogue » : au-dessus de 1024 px, `CardsExplorer` affiche les filtres en colonne, pas dans un tiroir. Le test peut dépendre du tiroir.
- `sweep.spec.ts` filtre des bruits propres à WebKit, valables aussi pour Safari desktop.

## Goals / Non-Goals

**Goals :**
- Les quatre appareils passent avec `npm run test:e2e`, les tests sans objet étant ignorés avec une raison lisible dans le rapport `list`.
- Chaque différence de mise en page ordinateur/téléphone citée dans la proposition a un test qui la couvre.

**Non-Goals :**
- Dupliquer chaque test en version ordinateur : la plupart des parcours (collection, decks, tournoi, boutique, paramètres, session, thème) sont les mêmes à la souris, ils tournent tels quels.
- Refactoriser les specs existantes au-delà des gardes nécessaires.

## Decisions

**Projets `desktop-chrome` et `desktop-safari` à partir de `devices["Desktop Chrome"]` et `devices["Desktop Safari"]`.** Viewport 1280×720, `isMobile: false`, `hasTouch: false` : au-dessus des seuils `sm` et `lg`, donc la mise en page « large » complète. Mêmes moteurs que les téléphones (Chromium, WebKit) : pas de navigateur de plus à installer. *Alternative écartée :* ajouter Firefox, utile mais nouveau moteur à installer et à stabiliser ; reporté.

**Garde par la fixture intégrée `isMobile`, pas par nom de projet.** `test.skip(!isMobile, "…")` pour les tests tactiles, `test.skip(isMobile, "…")` pour les tests ordinateur. La garde décrit la capacité testée et reste juste si l'on ajoute un appareil. *Alternative écartée :* `grep`/`grepInvert` par tag dans la config, moins visible à la lecture du test et silencieux dans le rapport.

**Le test de navigation devient générique.** Il garde le sélecteur `navigation "Sections"`, s'exécute partout, et vérifie en plus quelle barre est affichée : celle du bas sur téléphone, celle de l'en-tête sur ordinateur. Son titre ne parle plus de « barre du bas ». *Alternative écartée :* deux tests séparés quasi identiques.

**Survol du tutoriel : `card.hover()` puis souris déplacée hors de la carte.** Même vérification que l'appui long (calque `.dm-lift` visible, animations terminées, boîte dans le viewport, aucun ancêtre qui rogne), factorisée dans une fonction partagée par les deux tests. Fin du test : `page.mouse.move(0, 0)` et `.dm-lift` disparaît.

**Filtres du catalogue : vérification par la mise en page, pas par la classe CSS.** Sur ordinateur, les contrôles de filtre sont visibles sans ouvrir de tiroir ; sur téléphone, le test actuel continue d'ouvrir le tiroir. Si le test `préférences` dépend du tiroir, il prend une branche selon `isMobile`.

**Scripts ciblés par `--project`.** `test:e2e:desktop` = `playwright test --project=desktop-chrome --project=desktop-safari`, `test:e2e:mobile` = `--project=iphone --project=pixel`. Le reste de la ligne de commande s'ajoute après `--` (ex. `npm run test:e2e:desktop -- sweep`).

**Campagne globale = suite de commandes existantes, pas de nouvel outil.** Ordre : `npm run typecheck`, `npm run lint`, `npm test` (Vitest unit + db), `npm run test:e2e`. Chaque étape est lancée même si la précédente échoue, pour avoir un bilan complet. Le bilan liste par appareil les tests passés, ignorés (avec raison) et en échec, avec la trace Playwright des échecs.

## Risks / Trade-offs

- [Durée du run doublée, en série] → scripts `:desktop` / `:mobile` pour itérer sur un groupe ; la campagne complète reste réservée à la vérification avant/après push.
- [Le badge « N » de `next dev` recouvre des éléments en bas à gauche, aussi sur ordinateur] → réutiliser le masquage `nextjs-portal` déjà présent dans le test de navigation partout où un clic tombe dans cette zone.
- [Safari desktop émulé ≠ vrai Safari macOS] → même limite que pour iOS, documentée ; vérification manuelle ponctuelle sur un vrai Mac si un bug n'apparaît qu'en production.
- [Un échec révèle un vrai bug de l'application sur ordinateur] → le corriger dans ce change seulement s'il est trivial et local ; sinon le noter dans le bilan et ouvrir un change dédié, sans masquer le test.
- [Comptes et lignes de test laissés en base en cas de plantage] → inchangé : fixture `account` avec suppression en `finally`, teardown global qui purge le préfixe du run.
