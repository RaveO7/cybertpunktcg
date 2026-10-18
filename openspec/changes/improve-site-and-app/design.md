# Design

## Context

Voir `proposal.md` pour la motivation, et les specs pour les exigences. Ce que le code fait aujourd'hui, et qui oriente l'approche :

- **Decks.**
  - `src/lib/deck-rules.ts` calcule déjà `deckShortfall`. Chaque ligne a sa quantité manquante, son `cheapestPrintingId` et son coût.
  - `DecksScreen` l'affiche dans un panneau et propose « Copier la liste ».
  - Un deck référence `Card`, pas `Printing`.
  - `src/lib/share.ts` gère le classeur partagé : jeton de 24 octets en base64url, `upsert`, page `/classeur/[token]` en `privateMetadata`.
- **Alertes.**
  - `evaluateWishlistAlerts` (`src/lib/wishlist.ts`) est appelée en fin d'`importPrices` (`src/lib/price-import.ts`), lancée chaque jour à 5 h par le cron Vercel.
  - Elle met à jour `alertAt`, `alertPrice` et `alertSeen`, mais ne renvoie que des compteurs.
- **Service worker.** `public/sw.js` gère le cache (shell, données, compte, images) mais ni `push` ni `sync`.
- **Écritures.**
  - `CollectionProvider` appelle `mutationFetch` directement. Hors ligne, la requête échoue avec le message `errors.request.offline`.
  - Seul `patchLine` est optimiste.
  - La collection est relue hors ligne via `readSavedCollection` (`src/lib/offline.ts`).
- **Recherche.**
  - `matchesSearch` et `normalizeText` (`src/lib/logic.ts`) font une recherche par sous-chaîne, mot par mot.
  - Le tri est fait à part par `sortPrintings`, selon un `SortKey`.
  - Le navigateur de cartes des decks a son propre filtre `query`.
- **Chargement.**
  - `Dashboard` affiche `AppSplash` tant que `!ready` ; `InvestmentScreen` affiche une ligne « Chargement… ».
  - La tâche 3.2 de `instant-app-session-resume` demande des squelettes par écran une fois la session séparée de `ready`.
- **Fenêtres.**
  - Elles ont déjà `role="dialog"` et `aria-modal`, et certaines placent le focus à l'ouverture (`CardModal`, `DecksScreen`).
  - Aucune ne piège le focus, ne rend l'arrière-plan inerte ni ne rend le focus à l'élément d'origine de façon systématique.
  - `Header` ignore les gestes de balayage quand `[aria-modal=true]` est présent.

## Goals / Non-Goals

**Goals :**
- Réutiliser au maximum ce qui existe : `deckShortfall`, le modèle du classeur partagé, `evaluateWishlistAlerts`, le service worker et le cache hors ligne.
- Garder chaque volet livrable et testable seul, dans l'ordre des tâches.
- N'ajouter qu'une dépendance (`web-push`).

**Non-Goals :**
- Background Sync API : pas de support Safari/iOS. La synchronisation se fait dans la page.
- Index de recherche côté serveur, ou bibliothèque de recherche floue (Fuse, MiniSearch).
- Refonte visuelle des écrans découpés.

## Decisions

### 1. Ajout des manquantes : nouvelle route `POST /api/wishlist/bulk`
- **Entrée.** `{ printingIds: string[] }`, au plus 200 tirages, validés par un schéma zod dans `api-schemas.ts`.
- **Écriture.** `createMany` avec `skipDuplicates` côté Postgres. SQLite ne gère pas `skipDuplicates` : on y fait, dans une transaction, une lecture des existants puis une création des absents. La fonction vit dans `src/lib/wishlist.ts`.
- **Réponse.** `{ added, alreadyPresent, items }`.
- **Choix du tirage.** C'est le client qui choisit (`cheapestPrintingId`, sinon le premier tirage), car `deckShortfall` le fait déjà avec les données du catalogue.
- **Alternative écartée.** Boucler sur `POST /api/wishlist` : N requêtes, et pas d'atomicité, ce qui contredit le scénario « Échec » de la spec.

### 2. Partage de deck : modèle `DeckShare` séparé
- **Modèle.** `DeckShare { id, deckId @unique, token @unique, createdAt }`, avec `onDelete: Cascade` sur `Deck`. C'est le même schéma que `CollectionShare`.
- **Code.** `src/lib/deck-share.ts` reprend `createShareToken`, extrait de `share.ts` vers un utilitaire commun.
- **API.** `GET/POST/DELETE /api/decks/[id]/share`. `POST { rotate?: boolean }` suit le contrat de `/api/share`. Un deck d'un autre compte renvoie 404.
- **Page.** `src/app/[locale]/deck/[token]/page.tsx`, composant serveur, `privateMetadata` plus `openGraph`.
  - L'analyse (`analyzeDeck`) et le prix (`deckShortfall` avec une possession vide, donc seulement `deckCost`) sont calculés côté serveur à partir du catalogue en cache (`CATALOG_CACHE_TAG`).
  - La page est rendue dynamiquement, pour refléter l'état courant du deck.
- **Image d'aperçu.** `src/app/og/deck/[token]`, sur le modèle de `src/app/og/tournament` : nom du deck et images des 3 Legends.
- **Copie.** `POST /api/decks` existant, avec `{ name, cards }` lus sur la page.
- **Route.** `"/deck/[token]": "/deck/[token]"` dans `src/i18n/routing.ts`.
- **Alternatives écartées.**
  - Un champ `shareToken` sur `Deck` : moins cohérent avec `CollectionShare`, et complique la rotation et l'audit.
  - Une page indexable : le contenu est créé par les utilisateurs, le lien est non listé, et la confidentialité passe avant.

### 3. Notifications push : Web Push standard avec VAPID
- **Modèle.** `PushSubscription { id, userId, endpoint @unique, p256dh, auth, locale, createdAt }`, supprimé en cascade avec `User`.
- **Abonnement.**
  - Le client appelle `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` avec la clé publique, exposée par `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
  - Il envoie l'abonnement à `POST /api/push/subscribe` (`upsert` par endpoint, qui réattribue l'endpoint au compte courant).
  - `DELETE /api/push/subscribe { endpoint }` désabonne. La déconnexion l'appelle avant `/api/auth/logout`, puis appelle `subscription.unsubscribe()`.
- **Envoi.**
  - `evaluateWishlistAlerts` renvoie en plus `triggeredItems: { userId, printingId, price }[]`.
  - Un nouveau module `src/lib/push.ts` les regroupe par compte et envoie une notification par abonnement, avec `Promise.allSettled` et une concurrence limitée (10). Il supprime les abonnements qui répondent 404 ou 410.
  - Le texte est construit côté serveur dans la langue de l'abonnement (`getTranslations` de next-intl, avec la locale de l'abonnement) : nom de carte localisé, prix formaté.
- **Service worker.** `public/sw.js` reçoit `push` (`showNotification` avec un `tag` « price-alerts », pour remplacer une notification précédente plutôt que d'empiler) et `notificationclick` (focus d'une fenêtre existante, sinon `clients.openWindow` vers la liste de souhaits dans la langue de l'abonnement).
- **Cron.** L'envoi se fait dans `importPrices`, après l'évaluation, dans un `try/catch` qui passe par `reportError`. Un échec ne fait jamais échouer l'import.
- **iOS.** Le push n'existe que dans la PWA installée (iOS 16.4 et plus). L'option des réglages détecte `display-mode: standalone` et l'absence de `PushManager` pour afficher l'explication.
- **Alternatives écartées.**
  - Un service tiers (OneSignal, FCM direct) : dépendance externe et données envoyées à un tiers.
  - L'e-mail : hors périmètre, et il n'y a pas de fournisseur d'e-mail configuré.

### 4. Recherche : distance de Damerau-Levenshtein bornée, en code maison
- **Index.** Le texte normalisé de chaque tirage est découpé en mots une seule fois, dans un `Map<printingId, { nameWords, nameText, rulesText }>` construit avec le catalogue (`useMemo`). Aujourd'hui, `haystack()` est recalculé à chaque frappe.
- **Correspondance d'un mot de la saisie.**
  - Recherche exacte d'abord (comportement actuel).
  - Sinon, si le mot a 5 caractères ou plus, distance de Damerau-Levenshtein (transpositions adjacentes) bornée, avec sortie anticipée, contre les mots du nom : seuil 1, ou 2 à partir de 9 caractères.
  - Les numéros gardent `numberMatches`.
- **Score.** `matchesSearch` devient `searchScore(...)`, qui renvoie `null` (pas de correspondance) ou un score par paliers : 5 nom exact, 4 préfixe, 3 tous les mots dans le nom, 2 approché, 1 règles seulement. `matchesSearch` reste un enveloppe (`score !== null`) pour les appels existants.
- **Classement.** `filterPrintings` et `sortPrintings` appliquent le classement par pertinence quand `q` n'est pas vide et que le tri est celui par défaut de l'écran. Un tri stable conserve l'ordre par défaut à pertinence égale.
- **Navigateur des decks.** Son filtre `query` est remplacé par la même fonction.
- **Réactivité.** `useDeferredValue` sur la saisie dans `CardsExplorer` et dans le navigateur des decks.
- **Alternative écartée.** Fuse.js : plus lourd (environ 20 ko), avec un score difficile à aligner sur les paliers de la spec.

### 5. Écritures hors ligne : file en IndexedDB, rejouée dans la page
- **Module.** `src/lib/offline-queue.ts`, pur et testable.
  - Il stocke dans IndexedDB (base `cptcg-queue`) des opérations `{ seq, userId, kind: "save" | "patch" | "delete", lineId, payload, createdAt }`.
  - IndexedDB plutôt que localStorage : écriture atomique, accès depuis le service worker plus tard, et pas de limite de 5 Mo partagée avec les préférences.
- **Identifiants temporaires.** Une ligne créée hors ligne reçoit un id `tmp_<uuid>`.
  - **Compactage avant envoi.** `patch` ou `delete` d'une ligne `tmp_` se replient sur son `save` : une suppression annule le `save`, un `patch` modifie sa charge utile. Cela garantit les scénarios « ajout puis modification » et « ajout puis suppression ».
  - **Après un `save` réussi**, l'id `tmp_` est remplacé par l'id serveur dans la file et dans l'état.
- **Déclenchement.**
  - Dans `CollectionProvider`, `saveLine`, `patchLine` et `deleteLine` tentent la requête.
  - Sur `TypeError` réseau, ou si `navigator.onLine === false`, l'opération est mise en file et appliquée de façon optimiste. `MutationResult` est simulé localement à partir du catalogue (nom et état).
  - `saveBatch`, `importLines` et `deleteAccount` gardent le comportement actuel (erreur « hors ligne »).
- **Rejeu.**
  - Il démarre à l'événement `online`, au chargement de la collection en ligne et au retour de visibilité de l'onglet.
  - Il est séquentiel et protégé par un verrou (`navigator.locks` si disponible, sinon un drapeau en mémoire), pour éviter deux onglets en parallèle.
  - Classement des réponses : 2xx retire l'opération ; 401 arrête et garde la file ; 404, 409 et 422 retirent l'opération et ajoutent un message ; 5xx et erreur réseau arrêtent, puis réessaient avec un délai croissant (5 s, 30 s, 2 min).
- **Affichage.**
  - La collection affichée vaut `serveur (ou cache) ⊕ file`. La file est réappliquée après chaque `load` et après `readSavedCollection`.
  - `CollectionContextValue` expose `pendingCount`, `syncing` et `syncErrors`.
  - `Header` affiche l'indicateur ; le marqueur « en attente » d'une ligne passe par `pendingIds`.
- **Compte.** Les opérations sont filtrées par `userId`. `endSession` ne vide pas la file (scénario « session expirée »), mais la déconnexion volontaire la vide après confirmation.
- **Alternatives écartées.**
  - Background Sync dans le service worker : non géré par Safari.
  - Mettre les requêtes en file dans le service worker en interceptant les `fetch` : l'optimisme côté interface devient opaque, et les ids temporaires sont difficiles à gérer.

### 6. États de chargement : composant `ScreenSkeleton` et règle « données ou squelette »
- **Composants.** `src/components/site/ScreenSkeleton.tsx` contient des blocs de base (`SkeletonBlock`, `SkeletonRows`) avec `aria-busy="true"`, un libellé visuellement masqué « Chargement » et une animation coupée par `motion-reduce`.
- **Squelettes.** Chaque écran (Dashboard, Investment, Decks, Wishlist, Settings) a une variante qui reprend sa grille.
- **Règle.** Un écran rend son squelette tant que `catalog === null`, ou tant que ses données propres (decks, souhaits, historique) sont en chargement. Il rend son état d'erreur avec « Réessayer » si le chargement a échoué (`error` du provider, ou statut local comme `chartStatus === "error"`).
- **Coordination.** Ce volet s'appuie sur `ready` / `catalog` tels qu'ils sont. Si `instant-app-session-resume` est livré avant, on utilise son statut de session. Sa tâche 3.2 est cochée en renvoyant à ce changement.
- **Alternative écartée.** `loading.tsx` par route : inutile ici, car les données sont chargées côté client par le provider et non par le rendu serveur.

### 7. Fenêtres : un hook `useModal` commun
- **Hook.** `src/components/use-modal.ts`, appelé `useModal(ref, { open, onClose, initialFocus, closeOnEscape })`. À l'ouverture, il :
  - mémorise `document.activeElement` ;
  - place le focus ;
  - pose `inert` sur les frères du portail (ou sur `#app-root`) ;
  - bloque le défilement (`overflow: hidden` sur `html`, avec compensation de la barre de défilement) ;
  - piège Tab et Maj+Tab ;
  - empile les fenêtres dans une pile de module, pour qu'Échap ne ferme que la plus haute.
- **Fermeture.** Il restaure le focus si l'élément est encore dans le DOM.
- **Application.** Le hook est appliqué à : `CardModal`, `QuickAddSheet`, le tiroir de filtres et la fenêtre de `CardsExplorer`, les deux fenêtres de `DecksScreen`, `HowToPlayScreen` et `HeroCardFan`.
- **Alternatives écartées.**
  - L'élément `<dialog>` natif avec `showModal()` : il gère focus et inertie, mais casse les animations de feuilles existantes et le positionnement en `fixed`. On pourra y migrer plus tard, le hook isolant le comportement.
  - Une bibliothèque (Radix, react-aria) : dépendance lourde pour un besoin limité.
- **Sélection au clavier.**
  - `CardsExplorer` ajoute un bouton « Sélectionner », qui bascule le mode sélection, et un raccourci (touche `s` quand le focus est dans la grille).
  - `VirtualCardGrid` gère un indice de focus avec un `tabindex` mobile (un seul tabindex 0) et les flèches, en tenant compte du nombre de colonnes.
  - Espace bascule la carte ; Maj+flèche étend la sélection depuis l'ancre.
  - Une région `aria-live="polite"` annonce le compte.

### 8. Découpage des gros composants
- **Méthode.** Découpage mécanique, sans changement de comportement, un fichier à la fois, avec typecheck, tests unitaires et E2E existants entre chaque.
  - `DecksScreen` → `src/components/decks/` : `DeckList`, `DeckEditor`, `DeckBrowser`, `ShortfallPanel`, `ExportPanel`, `ImportPanel`, `ShareDeckPanel` (nouveau).
  - `Dashboard` → `src/components/dashboard/` : sections par bloc.
  - `CardModal` → `src/components/card-modal/` : en-tête, onglets prix, impressions, règles.
  - `InvestmentScreen` → `src/components/investment/` : `PriceChart` reste, et la table et les filtres sont extraits.
  - `CardsExplorer` → extraction de la sélection (`use-marquee-selection.ts`, `use-keyboard-selection.ts`) et de la barre d'actions.
- **Chargement à la demande.** Avec `next/dynamic`, pour les panneaux secondaires : `ExportPanel`, `ImportPanel`, `ShareDeckPanel`, le graphique de `InvestmentScreen` et l'onglet prix de `CardModal`.
- **Ordre.** Le découpage de `DecksScreen` et de `CardsExplorer` passe avant les volets qui les modifient (partage, ajout des manquantes, recherche, sélection clavier), pour éviter de grossir encore ces fichiers.
- **Travail non commité.** Le travail en cours (`QuickAddSheet.tsx` et les modifications de `CardsExplorer`, `CardTile`, `VirtualCardGrid`) doit être commité avant de commencer.

## Risks / Trade-offs

- **[Clés VAPID absentes en local ou en preview]** → `src/lib/push.ts` ne fait rien et journalise une seule fois. L'option des réglages est masquée si la clé publique est absente.
- **[Push iOS limité à la PWA installée]** → message explicatif. Les alertes dans l'application restent la source de vérité.
- **[Notifications pendant l'import, cron limité à 300 s]** → envoi borné en concurrence, abonnements expirés purgés. Le volume actuel (quelques dizaines de comptes) est très en dessous de la limite.
- **[Conflits hors ligne entre appareils]** → dernier écrit gagne côté serveur, comme aujourd'hui en ligne. Un refus 404/409 est signalé à l'utilisateur, sans fusion automatique.
- **[File corrompue ou schéma modifié]** → chaque opération a une version, et une opération illisible est abandonnée avec un message, sans bloquer la file.
- **[Faux positifs de la recherche approchée]** → seuils stricts (5 et 9 caractères), approché seulement sur les noms, et classé après l'exact.
- **[Le piège de focus casse les gestes ou les portails existants]** → `Header` s'appuie déjà sur `[aria-modal=true]`. Les tests E2E `a11y.spec.ts` et `keyboard.spec.ts` sont étendus avant d'appliquer le hook partout.
- **[Le découpage introduit des régressions]** → déplacements purs, revus par diff. Les E2E desktop et mobile tournent après chaque fichier.
- **[Pollution de la base par les tests de partage et de push]** → comptes `@example.com`, nettoyage dans un `finally`, SQLite local uniquement (règles du projet).

## Migration Plan

1. **Base.** Ajouter `DeckShare` et `PushSubscription` à `prisma/schema.prisma` et `schema.sqlite.prisma`, puis lancer `node scripts/prisma.mjs db push` en local. En production, `scripts/vercel-db-push.mjs` applique le schéma au build. Les changements sont purement additifs.
2. **Secrets.** Générer les clés VAPID (`npx web-push generate-vapid-keys`) et les ajouter à Vercel : `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT=mailto:…`.
3. **Service worker.** Incrémenter la `VERSION` de `public/sw.js`, pour que les clients prennent les nouveaux gestionnaires `push`.
4. **Retour arrière.**
   - Chaque volet est indépendant.
   - Retirer les clés VAPID désactive les envois sans casser l'interface.
   - Les tables ajoutées peuvent rester en place si on revient en arrière sur le code.
   - La file hors ligne est ignorée par un ancien client : les opérations restent dans IndexedDB sans effet.

## Open Questions

- Texte exact et icône des notifications (icône du manifest, ou image de la carte) : à trancher pendant l'implémentation, sans effet sur les specs.
- Plafond de 200 tirages par appel `/api/wishlist/bulk` : à ajuster si un deck dépasse 50 cartes distinctes (impossible aujourd'hui avec 50 cartes maximum).
