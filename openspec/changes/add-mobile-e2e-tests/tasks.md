# Tasks

## 1. Installation et serveur de test

- [x] 1.1 Ajouter `distDir: process.env.NEXT_DIST_DIR || ".next"` dans `next.config.ts`. Lancer `next dev --port 3100` avec `NEXT_DIST_DIR=.next-e2e` pendant qu'un `next dev` tourne déjà sur 3000, et vérifier que les deux démarrent. Si le verrou bloque quand même, appliquer le repli de design.md (décision 2) et le noter dans design.md.
- [x] 1.2 Ajouter `@playwright/test` en devDependency, avec la même version que les navigateurs installés, et les scripts `test:e2e` (`playwright test`) et `test:e2e:install` (`playwright install chromium webkit`). Vérifier que `npm run test:e2e:install` se termine sans erreur.
- [x] 1.3 Ajouter au `.gitignore` : `/.next-e2e`, `/test-results`, `/playwright-report`, `/tests/e2e/screenshots`. Vérifier avec `git status` qu'aucun de ces dossiers n'apparaît après un run.
- [x] 1.4 Vérifier que `npm test` (Vitest) n'exécute aucun fichier de `tests/e2e`, et que `npm run typecheck` passe avec les nouveaux fichiers.

## 2. Configuration Playwright, garde SQLite et nettoyage

- [x] 2.1 Écrire `playwright.config.ts` : projets `iphone` (`devices['iPhone 15']`, WebKit) et `pixel` (`devices['Pixel 7']`, Chromium), `colorScheme: 'light'`, `serviceWorkers: 'block'`, `baseURL` `http://localhost:3100`, `workers: 1`, `retries: 0`, `trace: 'retain-on-failure'`, `webServer` (port 3100, `NEXT_DIST_DIR`, `TRUST_PROXY=1`, `reuseExistingServer`, timeout 180 s). Vérifier avec `npx playwright test --list` que chaque spec apparaît pour les deux appareils.
- [x] 2.2 Ajouter la garde SQLite dans la config et dans `tests/e2e/setup/global-setup.ts`. Vérifier qu'un lancement avec `DATABASE_URL=postgres://x` échoue avant tout démarrage du serveur, avec un message explicite.
- [x] 2.3 Dans le `globalSetup`, générer `E2E_RUN_ID` et vider `tests/e2e/screenshots`. Dans `tests/e2e/setup/global-teardown.ts`, supprimer les `User` dont l'e-mail correspond à `e2e.<runId>.%@example.com` et les `RateLimit` dont la clé se termine par `:e2e-<runId>`. Vérifier en tuant un test en plein milieu (`test.fail` volontaire puis `throw`) qu'aucune ligne du run ne reste en base.
- [x] 2.4 Écrire `tests/e2e/fixtures.ts` : la fixture `account` (création par `registerAccount` + `createSession`, cookie `cptcg_session` posé, suppression du `User` dans le teardown) et le helper `snap(page, name)`. Vérifier avec un test minimal qu'un compte apparaît pendant le test et disparaît après, y compris quand le test échoue.

## 3. Parcours testés

Chaque spec tourne sur `iphone` et `pixel` et prend au moins une capture avec `snap`.

- [x] 3.1 `session.spec.ts` : connexion par l'écran `/fr/connexion` (e-mail et mot de passe d'un compte de la fixture, `x-forwarded-for: e2e-<runId>`), arrivée sur le tableau de bord, puis rechargement et nouvel onglet : le compte reste affiché sans repasser par la connexion. Ajouter un cas où la session est supprimée en base pour vérifier le retour à l'écran de connexion. Le test supprime les clés `RateLimit` qu'il a créées. Vérifier qu'il passe sur les deux appareils.
- [x] 3.2 `collection.spec.ts` : ajouter en base une carte d'une impression existante au compte de test, puis vérifier qu'elle est visible sur `/fr` et que la page ne défile pas horizontalement (`scrollWidth <= clientWidth`). Passer en `skip` avec un message si le catalogue local est vide. Vérifier qu'il passe.
- [x] 3.3 `decks.spec.ts` : ouvrir `/fr/decks`, créer un deck par l'interface et vérifier qu'il apparaît dans la liste et qu'il n'y a pas de défilement horizontal. Le deck part avec le compte. Vérifier qu'il passe.
- [x] 3.4 `tutorial.spec.ts` : ouvrir `/fr/comment-jouer`, faire un appui long tactile sur une carte de la main (`pointerdown` touch, 500 ms), vérifier que `.dm-lift` est visible et que son rectangle tient dans le viewport, capturer, puis relâcher et vérifier que le calque disparaît. Vérifier qu'il passe.
- [x] 3.5 `theme.spec.ts` : avec le téléphone en thème clair, vérifier au chargement qu'il y a une seule `<meta name="theme-color">` à `#07080d` et `data-theme="dark"`. Passer au thème clair dans `/fr/parametres`, vérifier `#e8eef6` sans rechargement, puis vérifier que la valeur tient après rechargement. Vérifier qu'il passe.

## 4. Vérification d'ensemble

- [ ] 4.1 Lancer `npm run test:e2e` deux fois de suite, avec et sans `next dev` déjà lancé sur le port 3000. Vérifier que tout passe sur les deux appareils et que les captures sont présentes dans `tests/e2e/screenshots/{iphone,pixel}/`.
- [x] 4.2 Après le run, vérifier en base qu'il ne reste aucun `User` `e2e.%@example.com` ni aucune `RateLimit` `%:e2e-%`, et que le nombre de lignes des tables `User`, `RateLimit` et `CollectionItem` est identique à avant le run.
- [x] 4.3 Relire les captures des deux appareils (pas de contenu coupé, de débordement ni de carte rognée) et noter dans la PR les écarts qui restent à vérifier sur un vrai téléphone (barre du navigateur, encoche, clavier).

## Workflow follow-up

- Vérification rapide sur un vrai téléphone (barre d'adresse, encoche, clavier virtuel) avant de considérer le chantier terminé.
- Archiver le change avec `/opsx:archive` une fois validé.
