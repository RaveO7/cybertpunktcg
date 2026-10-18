# Proposal

## Why

Aujourd'hui, pour voir une modification sur téléphone, il faut pousser sur Vercel puis tester à la main sur son appareil. C'est lent, et les régressions mobiles (carte rognée dans le tutoriel, reprise de session, couleur des barres du navigateur) ne sont repérées qu'après le déploiement. Le projet n'a que des tests Vitest (unitaires et base) : rien ne pilote un vrai navigateur sur un écran de téléphone.

## What Changes

- Ajout de **Playwright** (`@playwright/test`) en dépendance de développement, avec deux téléphones émulés : **iPhone** (moteur WebKit, celui de Safari) et **Pixel** (Chromium). Écran tactile, taille, densité de pixels et user-agent de chaque appareil.
- Une configuration qui **démarre l'application toute seule** (`next dev`) et **refuse de s'exécuter** si `DATABASE_URL` ne pointe pas vers la base SQLite locale (`file:...`).
- Des **comptes de test en `@example.com`**, créés par test et **supprimés à la fin même en cas d'échec**, avec les compteurs du limiteur de débit qu'ils ont créés.
- Des tests e2e pour les parcours clés :
  - connexion, puis reprise de session après rechargement et après fermeture de l'onglet ;
  - collection (tableau de bord connecté) ;
  - decks ;
  - tutoriel jouable : appui long sur une carte, carte soulevée non rognée ;
  - thème : la balise `theme-color` suit le thème de l'application, au chargement et au changement dans les réglages.
- Des **captures d'écran** de chaque écran clé sur chaque appareil, rangées dans un dossier ignoré par git, pour une relecture visuelle.
- Les scripts `npm run test:e2e` et `npm run test:e2e:install` (installation des navigateurs).

**Hors périmètre** : comparaison automatique des captures avec une image de référence (régression visuelle pixel par pixel) ; exécution en CI ; tests sur un vrai Safari iOS ou un vrai appareil (barre d'adresse native, encoche, clavier virtuel, installation en appli), qui restent à vérifier à la main en fin de chantier ; connexion Google ou Apple.

## Capabilities

### New Capabilities
<!-- Aucune : outillage de test, aucun comportement de l'application ne change (skip_specs). -->

### Modified Capabilities
<!-- Aucune. -->

## Impact

- `package.json` : dépendance `@playwright/test`, scripts `test:e2e` et `test:e2e:install`.
- Nouveaux fichiers : `playwright.config.ts`, `tests/e2e/**` (tests, fixtures de compte, garde SQLite, nettoyage).
- `.gitignore` : sorties Playwright (`/test-results`, `/playwright-report`, `/tests/e2e/screenshots`).
- `vitest.config.ts` : rien à changer, ses `include` ne visent que `tests/unit` et `tests/db`.
- Base locale : seules des lignes créées par les tests, toutes supprimées à la fin. Aucun changement de schéma, d'API ni de code applicatif.
