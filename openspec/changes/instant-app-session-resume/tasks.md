# Tasks

## 1. Session mémorisée

- [x] 1.1 Créer `src/lib/session-hint.ts` (lecture, écriture, effacement de `cptcg-session-user` avec stockage injecté, tolérance aux exceptions et au JSON invalide, effacement de l'ancienne clé `cptcg-signed-in` à l'écriture) ; vérifier avec `tests/unit/session-hint.test.ts` (aller-retour, JSON corrompu, champs manquants, stockage qui lève, ancienne clé effacée) via `npm run test:unit`

## 2. Statut de session dans CollectionProvider

- [ ] 2.1 Ajouter `session: "unknown" | "signed-in" | "signed-out"` au contexte, reprendre l'utilisateur mémorisé au montage (sans écart d'hydratation) et lancer le catalogue en parallèle quand il existe ; vérifier `npm run typecheck` et l'absence d'avertissement d'hydratation dans la console en `npm run dev`
- [x] 2.2 Regrouper tous les chemins 401 et `logout` dans une fonction `endSession()` qui efface la mémoire, l'utilisateur et les données et passe à `"signed-out"` ; faire mémoriser l'utilisateur par `openSession` et par la vérification réussie ; vérifier par lecture que plus aucun `setUser(null)` direct ne subsiste hors `endSession`
- [ ] 2.3 Au démarrage, une erreur non-401 ne doit plus changer le statut (garder `"signed-in"` si l'utilisateur était mémorisé) et doit seulement renseigner `error` ; vérifier en `npm run dev` avec le réseau coupé (DevTools hors ligne, service worker désactivé) qu'un compte mémorisé ne voit pas l'écran de connexion
- [ ] 2.4 Adapter l'effet `sessionKey` pour ne pas vider le cache ni rafraîchir quand l'utilisateur vérifié a le même id que l'utilisateur mémorisé ; vérifier dans l'onglet Réseau qu'un démarrage connecté ne déclenche pas de requête RSC de `router.refresh()`

## 3. Consommateurs

- [ ] 3.1 `Header` : afficher la navigation selon `session === "signed-in"` ; `RequireUser` : `"signed-out"` → `AuthScreen`, `"unknown"` → chargement, `"signed-in"` → enfants ; vérifier en `npm run dev` qu'au rechargement de `/fr` connecté la navigation est visible dès le premier affichage (enregistrement Performance ou capture lente)
- [x] 3.2 Vérifier que `Dashboard`, `InvestmentScreen`, `DecksScreen`, `WishlistScreen` et `SettingsScreen` affichent leur propre état de chargement tant que `ready`/`catalog` ne sont pas prêts (pas de tableau vide ni de crash sur `catalog` nul) ; corriger ceux qui en manquent ; vérifier avec le réseau ralenti (« Slow 4G ») en ouvrant chaque écran directement — fait par `improve-site-and-app` (groupe 4) : squelette par écran (`ScreenSkeleton`), état d'erreur avec « Réessayer », vérifiés par `tests/e2e/loading-states.spec.ts` (catalogue retardé puis en échec)

## 4. Vérification d'ensemble

- [ ] 4.1 Parcours manuels en `npm run dev`, avec un compte de test `@example.com` supprimé à la fin : (a) connexion puis réouverture → aucun écran de connexion ; (b) déconnexion puis réouverture → écran de connexion sur `/decks`, pas de navigation de compte ; (c) session supprimée en base pendant que l'app est ouverte, puis réouverture → écran de connexion et mémoire effacée ; (d) valeur `cptcg-session-user` falsifiée sans cookie → écran de connexion
- [x] 4.2 Lancer `npm run lint`, `npm run typecheck` et `npm run test:unit`, tous au vert
