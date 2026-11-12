# Tâches

## 1. Mesure de départ

- [x] 1.1 `next build` (avec `DATABASE_URL=file:...`) et relevé de « First Load JS shared by all » et des routes `/[locale]/collection` et d'une page tournoi, notés dans `design.md` (section Mesure). Vérif : chiffres consignés.

## 2. Utilitaire commun

- [x] 2.1 Créer `src/lib/client/api.ts` : `api<T>(url, options)`, `ApiError` (`kind`, `status`, `details`), `AbortError` relancée. Vérif : tests unitaires `tests/unit/api-client.test.ts` (fetch simulé) pour réseau absent → `offline`/`status 0`, 401 → `session`, 4xx/5xx avec et sans message → `server`, 2xx valide, 2xx invalide → `invalid`, annulation → relancée.
- [x] 2.2 Créer `useApiErrorMessage()` (client) et la clé `errors.request.unexpected` dans les 5 langues (fr d'abord). Vérif : `npx vitest run tests/unit/i18n-messages.test.ts` + test unitaire du choix de message par `kind`.
- [x] 2.3 Brancher `data-cache.ts` sur `api()` (`fetchCached(url, { schema, body? })`, `useCachedJson(url, schema)`, `prefetchCached(url, schema)` : schéma obligatoire, aucune entrée non vérifiée en cache), gardes de génération et d'éditions conservées. Vérif : typecheck + test unitaire (deux appels simultanés → un seul `fetch` ; réponse arrivée après un vidage → non mise en cache).

## 3. Schémas de réponse

- [x] 3.1 Créer `src/lib/api-responses.ts` (`zod/mini`, objets non stricts) : collection (`CollectionItemDTO`, `MutationResult`), liste de souhaits, decks, compte (`AuthUser`), partages, boutiques possédées. Remplacer les types écrits à la main par `z.infer` aux mêmes noms. Vérif : typecheck (serveur et client compilent sans changement d'usage).
- [x] 3.2 Schéma de `TournamentView` et sous-types ; le type reste dans `src/lib/tournament/view.ts`, concordance exacte imposée par `tests/unit/api-responses.test.ts` (design, décision 2). Vérif : typecheck (concordance, prouvée par mutation) + `npm run test:db` sur les tournois.
- [x] 3.3 Test par schéma sur une réponse réelle de route (dans les tests `tests/db/*` existants : collection, wishlist, decks, partage, tournoi, boutiques) : `schema.parse(body)` réussit. Vérif : `npm run test:db`.

## 4. Migration des écrans

- [x] 4.1 `CollectionProvider` : session (`openSession`, déconnexion), modifications directes et `sendOp` via `api()` ; réponse 2xx invalide dans la file → opération considérée envoyée puis rechargement de la collection. Vérif : `npm run test:db` + e2e `offline-sync`, `offline`, `collection` (desktop).
- [x] 4.2 `WishlistProvider`, `SharedBinderProvider` (partage validé, catalogue sans schéma), `decks/hooks.ts`, `SettingsScreen` (partage), `AuthScreen` (fournisseurs OAuth), `card-modal/PricePanel`, `investment/use-investment-history`. Vérif : typecheck + e2e `decks`, `investment`, `features` (desktop).
- [x] 4.3 Boutiques : `ShopManager` (suppression de `request`), `ShopReview`, `ShopDirectory`, `tournament/PublicationPanel` (`/api/shops/mine` via `fetchCached`). Vérif : typecheck + tests db boutiques.
- [x] 4.4 Tournois et annuaires : `tournament/hooks.ts` (sondage via `api()` sans cache, suppression de `postJson`/`ApiError` locaux), `LinkScreens`, `PlayerScreen`, `TournamentsScreen`, `SettingsTab`, `PublicTournamentPage`, `PublicDirectory`, `NearPicker`, `geo/AddressField`. Vérif : typecheck + e2e `features2` (desktop).
- [x] 4.5 Supprimer `src/components/send-json.ts` et tout import restant ; mettre à jour la règle `.claude/rules/composants.md` (utilitaire = `src/lib/client/api.ts`). Vérif : `grep` sans résultat pour `sendJson|mutationFetch|postJson` + `npm run check`.

## 5. Vérification finale

- [x] 5.1 `npm run check` et `npm run test:db` complets. Vérif : verts.
- [x] 5.2 e2e desktop et mobile : `npm run test:e2e:desktop`, `npm run test:e2e:mobile`. Vérif : verts (relance unique d'un test isolé seulement si l'échec est dû à la charge, cause notée).
- [x] 5.3 Scénario « réponse au format inattendu » : test unitaire où la liste de souhaits reçoit une réponse sans `printingId` → message traduit, liste inchangée. Vérif : test vert.
- [x] 5.4 Captures desktop et mobile de la collection, d'un deck, d'un tournoi et des boutiques (commande du CLAUDE.md), regardées. Vérif : aucun changement visuel.
- [x] 5.5 Nouvelle mesure `next build` comparée à 1.1, écart noté dans le résumé. Vérif : chiffres consignés ; au-delà de +15 Ko compressés sur le JS partagé, appliquer le découpage prévu (design, décision 5).

## Workflow follow-up

- Relecture par l'agent `relecteur`, archivage (`opsx:archive`) et commits (`commit-pr`), push après accord.
