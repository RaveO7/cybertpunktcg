# Design

## Contexte

Voir proposal.md (Pourquoi). État constaté :

- `src/components/send-json.ts` : `mutationFetch` (message « hors ligne » traduit) et `sendJson` (401 → « session expirée », message du serveur sinon). Utilisé par une douzaine de composants.
- `tournament/hooks.ts` : `postJson` + `ApiError(message, status, details)`, `status: 0` = pas de réseau ; les écrans tournoi testent `error.status === 0`.
- `ShopManager` : `request` (sans hors-ligne ni 401).
- `CollectionProvider` : `fetch` + `readJson` maison pour la session, les modifications et la file (`sendOp` → `{ status, body }` classé par `classifyResponse` de `src/lib/offline-queue.ts` : 2xx ok, 401 auth, 0/408/429/5xx retry, le reste rejeté).
- `data-cache.ts` : `fetchCached` (GET en cache, requêtes identiques regroupées, garde de génération et d'éditions) et `useCachedJson`. Ses erreurs ne gardent que le code HTTP.
- Une vingtaine de `fetch` directs lisent `response.json()` avec `as T`.
- Zod 4.6.5 est installé, utilisé seulement côté serveur (`api-schemas.ts`) ; `zod/mini` est disponible.

## Objectifs / Hors objectifs

**Objectifs :** un seul chemin pour tout appel client à `/api` ; erreurs classées de la même façon partout ; validation des réponses d'état ; aucun changement du protocole serveur ni de la file hors ligne.

**Hors objectifs :** reprendre les `catch` muets restants (chantier « erreurs avalées ») ; réécrire `classifyResponse` ou la file ; valider le catalogue ; modifier les routes API.

## Décisions

### 1. Module `src/lib/client/api.ts`
Fonction `api<T>(url, options)` avec `options = { method?, body?, schema?, signal?, cache? }` :
- corps sérialisé en JSON et `content-type` ajouté seulement si `body` est fourni ;
- échec de `fetch` (hors `AbortError`) → `ApiError` de type `offline`, `status: 0` ;
- 401 → `ApiError` `session` ; autre statut non 2xx → `ApiError` `server` avec le `error` (message traduit) et les `details` du corps s'ils existent ;
- 2xx : corps lu, puis `schema.parse` si un schéma est fourni ; échec → `ApiError` `invalid` (le problème est journalisé avec `console.error` et l'URL, sans les données) ;
- `AbortError` relancée telle quelle (annulation voulue, pas une erreur).

`ApiError` (`kind: "offline" | "session" | "server" | "invalid"`, `status`, `details`) remplace celle de `tournament/hooks.ts` ; `status: 0` reste vrai hors ligne pour ne pas changer la logique des écrans tournoi.

Le message affiché est choisi par l'écran avec un seul helper `useApiErrorMessage()` (client) : `offline` → `errors.request.offline`, `session` → `errors.request.sessionExpired`, `server` → message du serveur ou repli fourni, `invalid` → `errors.request.unexpected` (nouvelle clé, 5 langues). Les écrans tournoi passent leurs propres clés (`tournaments.offline`, `tournaments.failed`) comme aujourd'hui.

*Alternative écartée* : traduire dans `api()` (comme `sendJson`, qui reçoit `errors`). Cela oblige chaque appel à passer un traducteur et mélange transport et affichage ; la classification par `kind` suffit.

*Pourquoi `src/lib/client/`* : règle « où ranger » (`code-propre.md`) — utilitaire non visuel côté client hors de `components/`.

### 2. Schémas de réponse avec `zod/mini`, types dérivés
Fichier `src/lib/api-responses.ts` (importable côté client et serveur, sans dépendance serveur) : schémas `zod/mini` de `CollectionItemDTO`, `WishlistItemDTO`, `DeckDTO`, `AuthUser`, `TournamentView` (et sous-types), boutiques, partages, résultats de mutation, liste des tournois, historique de valeur.

Deux cas (choix validé) :
- **Types simples** (collection, souhaits, decks, compte, partages, liste des tournois) : `export type X = z.infer<typeof xSchema>` dans `api-responses.ts`, réexportés à leur emplacement actuel (`src/lib/types.ts`) — mêmes noms, une seule source. Les doublons (`MutationResult` ×3, `DeckShareInfo`, `ShareState`, `TournamentRow` local) disparaissent.
- **Types qui servent aussi aux calculs du serveur** (boutiques, `TournamentView` et ses sous-types de classement / top cut / résultats, points d'historique) : le type reste écrit à côté des calculs, et `tests/unit/api-responses.test.ts` impose à la compilation (`expectTypeOf(...).toEqualTypeOf`, lancé par `npm run typecheck`) que le schéma lui corresponde exactement. Même garantie (aucun écart possible, prouvé par mutation), sans toucher aux algorithmes.

`zod/mini` plutôt que `zod` : API fonctionnelle conçue pour être éliminée par arbre (tree-shaking), donc nettement plus légère dans le JavaScript du navigateur. Le serveur garde `zod` pour `api-schemas.ts`.

Objets en mode non strict (clés en plus acceptées) : un serveur plus récent qui ajoute un champ ne casse pas une interface ancienne ; un champ attendu absent ou du mauvais type la fait échouer proprement.

*Alternative écartée* : dériver aussi des schémas les types des modules de tournoi — cela réécrit les signatures des algorithmes (appariements, top cut, classements) pour un gain nul en sûreté.

### 3. `data-cache.ts` passe par `api()`
`fetchCached(url, { schema, body? })` appelle `api()` et conserve sa garde de génération et d’éditions ; ses erreurs deviennent des `ApiError` (plus seulement le code HTTP). `useCachedJson(url, schema)` et `prefetchCached(url, schema)` idem. Le schéma est **obligatoire** : le préchargement en tâche de fond ne peut pas placer dans le cache une réponse non vérifiée que les écrans reliraient ensuite. Les lectures directes répétables (`/api/shops/mine`, `/api/t/[code]`, `/api/wishlist`, `/api/share/[token]`, `/api/auth/oauth`) passent par `fetchCached` pour profiter du regroupement des requêtes en cours.

Le sondage de l'état d'un tournoi (`?rev=`, toutes les 5 s, mesure de l'horloge) reste un appel `api()` direct, sans cache : chaque requête doit réellement partir.

### 4. File hors ligne : protocole inchangé
`sendOp` utilise `api()` mais continue de fournir `{ status, body }` à `classifyResponse`. Une réponse 2xx invalide pour le schéma de `MutationResult` n'est **pas** un refus : l'opération est retirée de la file comme envoyée, puis la collection est rechargée depuis le serveur (exigence « Réponse modifiée en file de synchronisation »). Les modifications directes (`saveOp` hors file) gardent leur comportement : réseau absent → file.

### 5. Mesure du poids
Avant toute modification : `next build`, relevé de la taille des chunks JavaScript partagés (« First Load JS shared by all ») et de deux routes représentatives (`/[locale]/collection`, `/[locale]/tournois/...`). Même relevé à la fin ; écart reporté dans le résumé du change. Si l'ajout dépasse 15 Ko compressés sur le JS partagé, revoir le découpage (schémas importés seulement par les écrans qui les utilisent).

**Découpage appliqué (choix validé : chargement différé).** Première mesure avec les schémas importés directement : +19,3 Ko par page, seuil dépassé. Turbopack n'élimine pas les modules internes de `zod/mini` (≈ 15 Ko quel que soit le nombre de schémas utilisés), donc les importer « seulement là où ils servent » ne suffisait pas : toutes les pages connectées lisent la collection. Les schémas sont donc chargés à part (`import()` dynamique dans `loadResponseSchemas`, `src/lib/client/api.ts`), en parallèle de la première requête :
- `api(url, { schema: "decksSchema" })` prend le **nom** du schéma ; le type de la réponse en dérive (`Parsed<K>`). Le code client n'importe que des types de `api-responses.ts` (règle `composants.md`).
- Schémas impossibles à charger (réseau coupé entre la requête et leur arrivée) : `ApiError` `invalid` (pas `offline` : la requête a atteint le serveur, une écriture remise en file partirait deux fois), jamais une réponse non vérifiée ; la file hors ligne charge les schémas avant le premier envoi et, en cas d'échec, s'arrête en « à reprendre » sans rien envoyer.
- `CollectionProvider` demande les schémas dès son chargement ; l'affichage immédiat du tableau de bord au démarrage (réponses de `boot-requests` déjà arrivées) n'a lieu que si les schémas sont déjà là, sinon il passe par le chargement normal, quelques millisecondes plus tard.

### Mesure (JS compressé gzip, build de production)
Next 16 n'affiche plus les tailles au build : calcul par page = fichiers racine (`build-manifest.json` › `rootMainFiles`) + `entryJSFiles` du manifeste client de la page.

| Page | Avant | Après |
|---|---|---|
| JS commun (toutes les pages) | 127,1 Ko | 127,1 Ko |
| `/[locale]/cards` (collection) | 229,9 Ko | 231,1 Ko |
| `/[locale]/tableau-de-bord` | 202,7 Ko | 203,9 Ko |
| `/[locale]/decks` | 222,0 Ko | 223,1 Ko |
| `/[locale]/souhaits` | 197,7 Ko | 198,9 Ko |
| `/[locale]/t/[code]` (joueur) | 211,9 Ko | 213,0 Ko |
| `/[locale]/tournois/[id]` | 209,2 Ko | 210,4 Ko |
| `/[locale]/compte/boutique` | 202,2 Ko | 203,3 Ko |
| `/[locale]` (accueil) | 216,5 Ko | 217,6 Ko |

Écart : +1,1 à +1,2 Ko par page (utilitaire `api()` et hooks de message). Schémas et moteur Zod : un fichier à part de 18,1 Ko, absent du premier chargement, téléchargé une fois au premier appel vérifié puis gardé en cache par le navigateur.

## Risques / Compromis

- [Un schéma trop strict casse un écran qui marchait] → objets non stricts, schémas écrits à partir des types actuels et des réponses réelles (tests `tests/db/*` qui appellent les routes), test unitaire par schéma sur une réponse réelle de route.
- [Régression hors ligne] → `classifyResponse` et la file inchangées ; e2e `offline-sync` et `offline` rejoués.
- [Messages d'erreur différents sur certains écrans] → voulu (plus justes) ; les écrans qui affichaient un message codé en dur gardent leur repli traduit.
- [Poids du bundle] → `zod/mini` + mesure avant/après (décision 5).
- [`TournamentView` volumineux à décrire] → schéma écrit une fois ; le type `buildView` en dérive, le typecheck garantit la concordance avec le code serveur.

## Plan de migration

Remplacement écran par écran, chaque étape vérifiée (typecheck, lint, tests de la zone) ; suppression des anciens utilitaires en dernier, quand plus rien ne les importe. Aucun changement serveur ni de données : retour arrière par simple `git revert`.
