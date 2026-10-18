# Proposal

## Why

Les tests Playwright ne tournent que sur deux téléphones émulés (iPhone en WebKit, Pixel en Chromium). Sur ordinateur, l'application a une autre mise en page : navigation dans l'en-tête au lieu de la barre du bas (seuil `sm`, 640 px), filtres du catalogue en colonne au lieu d'un tiroir (seuil `lg`, 1024 px), carte du tutoriel soulevée au survol de la souris au lieu de l'appui long. Rien de tout cela n'est vérifié automatiquement : une régression sur ordinateur n'est repérée qu'à la main, après le déploiement. Il faut pouvoir lancer une campagne de test globale, ordinateur et téléphone, avant de considérer un push comme bon.

## What Changes

- Deux **ordinateurs émulés** ajoutés à Playwright, à côté des deux téléphones : **Chrome desktop** (Chromium) et **Safari desktop** (WebKit), souris, sans écran tactile, fenêtre ≥ 1280 px de large.
- Les tests existants tournent sur les **quatre appareils**. Ceux qui n'ont de sens que sur téléphone sont **ignorés sur ordinateur, avec une raison affichée** (appui long au doigt, clavier virtuel, barre du bas), jamais supprimés.
- Des **équivalents ordinateur** pour les parcours dont la forme change :
  - navigation : chaque lien de la barre « Sections » de l'en-tête ouvre son écran, sans défilement horizontal ;
  - tutoriel : survol à la souris d'une carte de la main, carte soulevée entière à l'écran et non rognée, puis retombée quand la souris s'en va ;
  - catalogue : filtres affichés en colonne (pas de tiroir).
- Le **balayage de toutes les pages** (erreurs JS, requêtes en échec, débordement horizontal) couvre aussi l'ordinateur.
- Des **captures d'écran** rangées par appareil, comme aujourd'hui (`tests/e2e/screenshots/<appareil>/`).
- Des scripts pour cibler un groupe d'appareils : `npm run test:e2e:desktop`, `npm run test:e2e:mobile` ; `npm run test:e2e` lance les quatre.
- Une **campagne globale** en fin de chantier : typecheck, lint, Vitest (unitaires et base), puis Playwright sur les quatre appareils, avec un bilan des échecs. Elle reprend la vérification encore ouverte du change `add-mobile-e2e-tests` (tâche 4.1).

**Hors périmètre** : Firefox ; tablettes ; comparaison automatique des captures avec une référence ; exécution en CI ; tests du mode hors-ligne sur ordinateur au-delà de ce que `offline.spec.ts` fait déjà (il reste conditionné à `E2E_PROD_URL`) ; corrections de l'application révélées par la campagne, qui feront l'objet de changes séparés si elles ne sont pas triviales.

## Capabilities

### New Capabilities
<!-- Aucune : outillage de test, aucun comportement de l'application ne change (skip_specs). -->

### Modified Capabilities
<!-- Aucune. -->

## Impact

- `playwright.config.ts` : deux projets `desktop-chrome` et `desktop-safari` en plus de `iphone` et `pixel`.
- `tests/e2e/*.spec.ts` : garde « téléphone seulement » sur les tests tactiles, nouveaux tests ordinateur (navigation d'en-tête, survol du tutoriel, filtres en colonne).
- `package.json` : scripts `test:e2e:desktop` et `test:e2e:mobile`. `test:e2e:install` installe déjà Chromium et WebKit, rien à ajouter.
- Durée : exécution en série (`workers: 1`, une seule base SQLite), la campagne complète prend environ deux fois plus de temps qu'aujourd'hui.
- Base locale : uniquement des lignes créées par les tests, toutes supprimées à la fin, même en cas d'échec. Aucun changement de schéma, d'API ni de code applicatif.
