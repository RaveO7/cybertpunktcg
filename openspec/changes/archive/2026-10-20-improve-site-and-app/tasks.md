# Tasks

## 1. Préparation

- [x] 1.1 Faire commiter par l'utilisateur le travail en cours (`QuickAddSheet.tsx`, `CardsExplorer`, `CardTile`, `VirtualCardGrid`, `Dashboard`, `catalog-pages`, `globals.css`, `cards.json` ×5). Vérifier que `git status` est propre avant de commencer.
- [x] 1.2 Relever la référence actuelle : `npm run typecheck`, `npm run test` et `npm run test:e2e:desktop` passent. Noter le résultat comme point de comparaison. Non relevée avant le début des travaux ; cochée à la demande de l'utilisateur. Référence = commit `780fdcc` (tailles des routes mesurées en 10.2), état final vérifié en 10.1.

## 2. Découpage des gros composants (sans changement visible)

- [x] 2.1 Découper `DecksScreen.tsx` dans `src/components/decks/` (`DeckList`, `DeckEditor`, `DeckBrowser`, `ShortfallPanel`, `ExportPanel`, `ImportPanel`) par déplacements purs. Vérifier : typecheck, et `tests/e2e/decks.spec.ts` passe.
- [x] 2.2 Extraire de `CardsExplorer.tsx` la sélection à la souris (`use-marquee-selection.ts`) et la barre d'actions. Vérifier : typecheck, et `tests/e2e/collection.spec.ts` passe.
- [x] 2.3 Découper `CardModal.tsx` dans `src/components/card-modal/`, avec l'onglet prix chargé via `next/dynamic`. Vérifier : typecheck, E2E collection, et la fiche s'ouvre et affiche les prix.
- [x] 2.4 Découper `Dashboard.tsx` dans `src/components/dashboard/` et `InvestmentScreen.tsx` dans `src/components/investment/`, avec le graphique chargé à la demande. Vérifier : typecheck, et `npm run test:e2e:desktop` et `npm run test:e2e:mobile` passent.
- [x] 2.5 Mesurer le chargement à la demande de `ExportPanel` et `ImportPanel` des decks via `next/dynamic`. Résultat : aucun gain sur `/decks` (panneaux d'environ 2 ko, compensés par le chargeur), donc imports statiques conservés ; `next/dynamic` est réservé aux panneaux à dépendance lourde (graphique de prix). Next 16 n'affiche plus la taille des routes : mesure faite sur les chunks d'entrée de la page dans `page_client-reference-manifest.js`.

## 3. Fenêtres accessibles (`site/dialog-accessibility`)

- [x] 3.1 Écrire `src/components/use-modal.ts` (focus initial, piège Tab, `inert` sur l'arrière-plan, blocage du défilement, pile pour Échap, restauration du focus). Ajouter un test E2E dans `keyboard.spec.ts` sur `CardModal` : Tab boucle, Échap ferme et le focus revient sur la tuile.
- [x] 3.2 Appliquer `useModal` à `QuickAddSheet`, au tiroir de filtres et à la fenêtre de `CardsExplorer`, aux deux fenêtres de `DecksScreen`, à `HowToPlayScreen` et à `HeroCardFan`. Vérifier avec un test E2E de fenêtres empilées (confirmation sur deck : Échap ne ferme que la confirmation), et `a11y.spec.ts` passe.
- [x] 3.3 Ajouter la sélection au clavier (bouton « Sélectionner », tabindex mobile et flèches dans `VirtualCardGrid`, Espace, Maj+flèches, Échap, annonce `aria-live`) dans `use-keyboard-selection.ts`. Couvrir le calcul des voisins selon le nombre de colonnes par des tests unitaires, et ajouter un test E2E « 3 cartes sélectionnées ».
- [x] 3.4 Ajouter les libellés (« Sélectionner », annonce du compte) dans les 5 langues. Vérifier : `tests/unit/i18n-messages.test.ts` passe.

## 4. États de chargement (`site/loading-states`)

- [x] 4.1 Créer `src/components/site/ScreenSkeleton.tsx` (`SkeletonBlock`, `SkeletonRows`, `aria-busy`, libellé masqué, `motion-reduce`). Vérifier par un test E2E avec reduced motion (pas d'animation calculée).
- [x] 4.2 Remplacer `AppSplash` et « Chargement… » par un squelette propre à chaque écran (Dashboard, Investment, Decks, Wishlist, Settings). Aucun écran n'affiche de 0 ni de liste vide avant les données. Vérifier par un test E2E qui retarde `/api/catalog` (`page.route`) : chaque écran montre `[aria-busy=true]` et aucun « 0 ».
- [x] 4.3 Ajouter l'état d'erreur avec « Réessayer » (provider en erreur, `chartStatus === "error"`). Vérifier par un test E2E qui fait échouer l'historique de prix : bouton visible, puis un clic recharge.
- [x] 4.4 Cocher la tâche 3.2 de `openspec/changes/instant-app-session-resume/tasks.md` en renvoyant à ce changement. Vérifier que le fichier est à jour.

## 5. Recherche tolérante (`catalog/card-search`)

- [x] 5.1 Implémenter dans `src/lib/logic.ts` : un index des mots par tirage, une distance de Damerau-Levenshtein bornée et `searchScore` (paliers 5→1, numéros inchangés), avec `matchesSearch` gardé comme enveloppe. Ajouter des tests unitaires dans `tests/unit/logic.test.ts` : « strretkid » → Streetkid, mot de 4 lettres non approché, « 012 » → numéro, pas de faute appliquée sur le texte de règles.
- [x] 5.2 Classer par pertinence dans `filterPrintings` / `sortPrintings` quand `q` n'est pas vide et que le tri est celui par défaut, avec un tri stable. Ajouter des tests unitaires : nom avant règles, tri par prix choisi respecté, ordre inchangé sans saisie.
- [x] 5.3 Brancher la même recherche dans le navigateur de cartes des decks, et ajouter `useDeferredValue` dans `CardsExplorer` et dans le navigateur des decks. Vérifier par un test E2E : saisie « strretkid » dans l'explorateur → la carte apparaît.

## 6. Decks : complétion (`decks/completion`)

- [x] 6.1 Ajouter `addWishlistItems(userId, printingIds)` dans `src/lib/wishlist.ts` (transaction, existants préservés) et `POST /api/wishlist/bulk` (zod, 200 au plus). Ajouter un test DB dans `tests/db/` : 3 ajoutés et 1 déjà présent, prix cible conservé. Compte `@example.com`, nettoyage dans un `finally`.
- [x] 6.2 Ajouter le bouton « Ajouter les manquantes à ma liste de souhaits » dans `ShortfallPanel` : tirage le moins cher, sinon le premier ; message « N ajoutées, M déjà présentes » ; erreur sans ajout partiel ; `WishlistProvider` mis à jour. Ajouter un test E2E dans `decks.spec.ts`.
- [x] 6.3 Afficher « complet / N manquantes » sur chaque deck de `DeckList`. Vérifier par un test E2E sur la liste des decks.
- [x] 6.4 Ajouter les messages dans les 5 langues. Vérifier : `i18n-messages.test.ts` passe.

## 7. Decks : partage (`decks/sharing`)

- [x] 7.1 Ajouter le modèle `DeckShare` à `prisma/schema.prisma` et `schema.sqlite.prisma`, extraire `createShareToken` dans un utilitaire commun et écrire `src/lib/deck-share.ts`. Vérifier : `node scripts/prisma.mjs db push` en local (SQLite) et typecheck.
- [x] 7.2 Créer `GET/POST/DELETE /api/decks/[id]/share` (rotation, deck d'un autre compte → 404). Ajouter des tests DB : création idempotente, rotation qui invalide l'ancien jeton, suppression du deck qui supprime le lien, accès d'un autre compte refusé. Nettoyage dans un `finally`.
- [x] 7.3 Ajouter la route `/deck/[token]` dans `src/i18n/routing.ts` et la page serveur : nom, propriétaire, Legends puis cartes par type, validité, total, prix du deck, copie de la liste, `privateMetadata` + `openGraph`, 404 si le lien est inactif. Vérifier par un test unitaire dans `seo-routes` ou `seo-metadata` (noindex) et par une ouverture manuelle sans compte.
- [x] 7.4 Créer l'image d'aperçu `src/app/og/deck/[token]` (nom du deck et Legends). Vérifier que l'URL renvoie une image PNG en local.
- [x] 7.5 Créer `ShareDeckPanel` (créer, copier, renouveler, révoquer), chargé à la demande, et le bouton « Copier dans mes decks » sur la page publique (connexion puis retour). Ajouter un test E2E : partager → ouvrir dans un contexte non connecté → voir la liste ; révoquer → 404 ; copier → nouveau deck.
- [x] 7.6 Vérifier par un test DB et par E2E qu'aucune donnée privée (e-mail, notes, collection) n'apparaît dans le HTML de la page. Ajouter les messages dans les 5 langues.

## 8. Alertes de prix par notification (`wishlist/price-alerts`)

- [x] 8.1 Ajouter la dépendance `web-push`, le modèle `PushSubscription` (deux schémas), et documenter les variables VAPID dans `.env.example` (ou équivalent). Vérifier : `npm install`, `db push` local et typecheck.
- [x] 8.2 Créer `POST/DELETE /api/push/subscribe` (upsert par endpoint, locale). Ajouter des tests DB : réattribution d'un endpoint à un autre compte, suppression en cascade avec `User`. Nettoyage dans un `finally`.
- [x] 8.3 Faire renvoyer à `evaluateWishlistAlerts` les `triggeredItems` (déclenchées seulement, ni suivi ni effacement). Ajouter un test DB sur une **copie** de `data/collection.db` (modèle : `tests/db/history-cache.test.ts`).
- [x] 8.4 Écrire `src/lib/push.ts` : regroupement par compte, une notification par abonnement, texte localisé (1 carte avec son prix, ou N cartes), concurrence 10, purge des 404/410, sans effet sans clés VAPID. L'appeler depuis `importPrices` dans un `try/catch`. Ajouter des tests unitaires avec l'envoi simulé : regroupement, texte, purge, et un échec qui ne bloque pas.
- [x] 8.5 Gérer `push` (tag « price-alerts ») et `notificationclick` (ouvrir ou mettre au premier plan la liste de souhaits) dans `public/sw.js`, sans incrémenter la `VERSION` (elle nomme les caches partagés avec `src/lib/offline.ts` ; l'incrémenter effacerait les images hors ligne, et toute modification de `sw.js` suffit à faire prendre les nouveaux gestionnaires). Vérifier manuellement en local avec `web-push send-notification` vers un abonnement de test. Vérifié sur un build de production local (Chromium, message livré par le protocole DevTools `ServiceWorker.deliverPushMessage`, faute de clés VAPID locales) : notification affichée avec titre, texte, icône et adresse de la liste de souhaits ; un second envoi remplace le premier (tag `price-alerts`) ; un message non JSON s'affiche avec le titre par défaut. L'envoi réel par un service push et le toucher de la notification (`notificationclick`) sont vérifiés en 10.3 sur téléphone.
- [x] 8.6 Ajouter l'option des réglages (activer / désactiver, autorisation refusée, navigateur incompatible, iOS non installé, masquée sans clé publique) et la proposition au premier prix cible dans la liste de souhaits. La déconnexion désabonne l'appareil. Ajouter un test E2E avec la permission accordée ou refusée via le contexte Playwright.
- [x] 8.7 Ajouter les messages (réglages et notifications) dans les 5 langues. Vérifier : `i18n-messages.test.ts` passe.

## 9. Écritures hors ligne (`collection/offline-sync`)

- [x] 9.1 Écrire `src/lib/offline-queue.ts` : stockage IndexedDB par compte, versions des opérations, compactage des ids `tmp_` (ajout puis modification, ajout puis suppression), remplacement d'id après un `save`, classement des réponses (2xx, 401, 404/409/422, 5xx). Ajouter des tests unitaires avec `fake-indexeddb` en dépendance de développement, ou un stockage injecté.
- [x] 9.2 Brancher la file dans `CollectionProvider` : `saveLine`, `patchLine` et `deleteLine` sont mis en file sur une erreur réseau ou hors ligne, avec un résultat optimiste local ; `saveBatch`, `importLines` et `deleteAccount` sont inchangés. La file est réappliquée après `load` et `readSavedCollection`. Le contexte expose `pendingCount`, `syncing`, `syncErrors` et `pendingIds`. Vérifier : typecheck et tests unitaires.
- [x] 9.3 Rejouer la file à l'événement `online`, au chargement en ligne et au retour de visibilité, avec un verrou entre onglets et un délai croissant. 401 garde la file jusqu'à la reconnexion du même compte. Étendre `tests/e2e/offline.spec.ts` : ajout puis modification hors ligne → rechargement → retour en ligne → une seule ligne de 3 sur le serveur ; ajout puis suppression → rien de créé. Nettoyage des données de test.
- [x] 9.4 Afficher l'indicateur dans `Header` (« N modifications en attente », synchronisation en cours), le marqueur sur les lignes, le message d'échec avec le nom de la carte, et la confirmation de déconnexion quand la file n'est pas vide. Ajouter un test E2E sur l'indicateur et la confirmation, et les messages dans les 5 langues.

## 10. Vérification d'ensemble

- [x] 10.1 Lancer `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e:desktop` et `npm run test:e2e:mobile`. Tout passe, et aucune donnée de test ne reste dans `data/collection.db` (vérifier qu'il n'y a pas d'utilisateur `@example.com`).
- [x] 10.2 Lancer `next build` et comparer la taille des bundles des routes `/decks`, `/cards`, `/tableau-de-bord` et `/investissement` avec la référence de 1.2 : hausse limitée au coût des nouvelles fonctions, et une baisse là où des panneaux sont chargés à la demande. Résultat (JS d'entrée en ko gzip, référence = build de HEAD `780fdcc` ; propre à la page / total à l'ouverture) : `/decks` 30,4 → 35,0 / 204,5 → 219,4 ; `/cards` 39,2 → 38,7 / 213,4 → 223,1 ; `/tableau-de-bord` 14,7 → 17,1 / 188,8 → 201,5 ; `/investissement` 16,2 → 14,5 / 190,3 → 198,9. La hausse commune (+5 ko gzip sur le layout) vient de la file hors ligne, du client des notifications et de l'ajout groupé à la liste de souhaits ; jugée négligeable (4 à 7 % du JS d'ouverture, chunks mis en cache par le service worker). Ces chiffres « après » servent de référence pour 11.3.
- [x] 10.3 Faire avec l'utilisateur un parcours manuel sur téléphone Android et sur iPhone (PWA installée) : notification reçue et ouverture de la liste de souhaits ; ajout hors ligne en mode avion puis synchronisation ; partage d'un deck ouvert depuis une messagerie (aperçu visible). Fait par l'utilisateur sur Android : tout fonctionne. Pas d'iPhone disponible : vérification iOS (PWA installée) reportée au premier iPhone disponible.

## 11. Regroupement des découpages inutiles (après les groupes 3 à 9)

- [x] 11.1 Passer en revue les fichiers créés par le découpage et les volets suivants (`src/components/decks/`, `cards-explorer/`, `card-modal/`, `dashboard/`, `investment/`). Pour chacun, noter sa taille, le nombre de paramètres qu'il reçoit et le nombre de fichiers qui l'importent. Établir la liste des regroupements proposés et la faire valider par l'utilisateur avant d'y toucher. Liste validée : réunir `ExportPanel` et `ImportPanel` dans `decks/TransferPanels.tsx` ; mettre `investment/chart-range.ts` dans `InvestmentChart.tsx` ; remettre `dashboard/hooks.ts` et `DashboardHero` (15 paramètres de simple transmission d'état) dans `Dashboard.tsx`. Gardés séparés : composants à plus de 8 paramètres ayant un rôle propre (`DeckBrowser`, `CardPreview`, `ScopeDetail`, `SetTable`, `InvestmentFilters`, `ModalHeader`), `SelectionBar` (`CardsExplorer` déjà long), et les modules réutilisés.
- [x] 11.2 Remettre dans son parent tout module dont la séparation n'aide ni la lecture ni le chargement : petit fichier importé à un seul endroit, composant qui reçoit plus de 8 paramètres uniquement pour faire passer l'état du parent, gain de chargement nul ou infime (< 1 ko gzip). Pistes déjà repérées : `ExportPanel` et `ImportPanel` dans un même fichier, `investment/chart-range.ts` dans `InvestmentChart.tsx`, `dashboard/hooks.ts` et `DashboardHero` dans `Dashboard.tsx`. Garder séparé ce qui a une responsabilité propre ou est réutilisé (éditeur et liste des decks, recherche de cartes, sélection à la souris, `dashboard/model.ts`, tri de l'investissement), ainsi que tout chargement via `next/dynamic` au gain mesuré.
- [x] 11.3 Vérifier : typecheck, lint, tests unitaires, `npm run test:e2e:desktop` et `npm run test:e2e:mobile` passent, et la taille JS propre à chaque route (`/decks`, `/cards`, `/tableau-de-bord`, `/investissement`) ne dépasse pas celle mesurée avant le regroupement.

## Workflow follow-up

- Ajouter `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans les variables d'environnement Vercel avant le déploiement en production.
- Archiver le changement (`/opsx:archive`) une fois la revue faite, puis vérifier que les specs `decks/*`, `wishlist/price-alerts`, `catalog/card-search`, `collection/offline-sync` et `site/*` apparaissent dans `openspec/specs`.
