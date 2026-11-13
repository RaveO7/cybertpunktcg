# Proposition

## Pourquoi

Le navigateur appelle `/api` de quatre façons différentes (`sendJson`/`mutationFetch`, `request` de `ShopManager`, `postJson` des tournois, une vingtaine de `fetch` directs). Chacune gère à sa manière l'absence de réseau, la session expirée et les messages d'erreur : un même problème s'affiche différemment selon l'écran, et un bug de gestion d'erreur doit être corrigé à plusieurs endroits. Les réponses sont en outre lues telles quelles (`as T`) : l'application est installable et garde son code en cache hors ligne, donc après un déploiement une ancienne version de l'interface peut recevoir une réponse au nouveau format et se casser sans aucune erreur visible.

## Ce qui change

- Un seul utilitaire client pour tous les appels à `/api` : même traitement de l'absence de réseau, de la session expirée (401), des erreurs renvoyées par le serveur (message déjà traduit) et des erreurs inattendues, sur tous les écrans.
- Les réponses qui alimentent l'état de l'application (collection, liste de souhaits, decks, tournois, boutiques, partage du classeur et des decks, compte) sont vérifiées par un schéma avant d'être utilisées. Une réponse au format inattendu produit un message d'erreur traduit, jamais un écran cassé ou une donnée corrompue.
- Le catalogue n'est pas vérifié (réponse très volumineuse, déjà versionnée et mise en cache) : le vérifier ralentirait chaque chargement sur mobile.
- Les lectures répétées passent par le cache client existant (`data-cache.ts`), qui regroupe les requêtes identiques en cours : une seule requête part au serveur.
- Suppression des utilitaires remplacés (`send-json.ts`, `request` de `ShopManager`, `postJson`/`ApiError` de `tournament/hooks.ts`).
- Aucun changement visible pour l'utilisateur en dehors de messages d'erreur plus justes et cohérents ; le fonctionnement hors ligne et la file de synchronisation restent identiques.

## Capacités

### Nouvelles capacités
- `site/api-requests` : comportement commun des échanges entre l'application et le serveur — absence de réseau, session expirée, erreurs du serveur, réponse au format inattendu, regroupement des lectures identiques.

### Capacités modifiées
Aucune : les exigences de `collection/offline-sync` et `site/loading-states` restent valables telles quelles et doivent continuer à être respectées.

## Impact

- Code client : `src/components/send-json.ts` (supprimé), `src/components/data-cache.ts`, `CollectionProvider`, `WishlistProvider`, `SharedBinderProvider`, `decks/hooks.ts`, `SettingsScreen`, `AuthScreen`, `card-modal/PricePanel`, `shops/*` (`ShopManager`, `ShopReview`, `ShopDirectory`), `public/*` (`PublicDirectory`, `NearPicker`, `PublicTournamentPage`), `geo/AddressField`, `tournament/*` (`hooks`, `LinkScreens`, `PlayerScreen`, `TournamentsScreen`, `SettingsTab`, `PublicationPanel`), `investment/use-investment-history`.
- Types partagés : les types de réponse (`CollectionItemDTO`, `WishlistItemDTO`, `DeckDTO`, `TournamentView`…) sont dérivés des schémas pour n'avoir qu'une seule source ; les noms restent identiques pour le code serveur.
- Dépendance : `zod` (déjà présent) est désormais aussi envoyé au navigateur, sous sa forme allégée `zod/mini`. Le poids du JavaScript est mesuré avant et après.
- API serveur : inchangée.
