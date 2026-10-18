# Proposal

## Why

L'application couvre déjà l'essentiel (collection, decks, souhaits, investissement, tournois, catalogue public). Un audit du code montre pourtant des manques qui gênent l'usage au quotidien :

- les alertes de prix ne sont visibles qu'en ouvrant l'application ;
- un ajout fait hors ligne échoue ;
- la recherche ne trouve rien à la moindre faute de frappe ;
- un deck ne se partage pas ;
- les cartes manquantes d'un deck se copient en texte, mais ne s'ajoutent pas à la liste de souhaits.

À cela s'ajoutent quelques points de qualité : écrans vides pendant le chargement, fenêtres sans piège de focus, composants de 1 100 à 1 900 lignes.

## What Changes

- **Decks, cartes manquantes** : le panneau « cartes manquantes » existe déjà (nombre d'exemplaires et coût au prix le plus bas). On ajoute :
  - une action « Ajouter les manquantes à ma liste de souhaits », qui ajoute pour chaque carte manquante son tirage le moins cher ;
  - un indicateur « complet / X manquantes » sur chaque deck de la liste.
- **Partage de decks** :
  - un lien public en lecture seule par deck, avec un jeton comme le classeur partagé ;
  - une page lisible sans compte, avec un aperçu de lien soigné (titre, image) ;
  - le propriétaire peut créer, renouveler et révoquer le lien. La page n'est pas indexée ;
  - un utilisateur connecté peut copier le deck partagé dans ses propres decks.
- **Alertes de prix par notification** :
  - l'utilisateur peut activer les notifications Web Push depuis les réglages ou la liste de souhaits ;
  - quand l'import quotidien des prix déclenche une alerte (prix tendance sous le prix cible), il reçoit une notification, même application fermée ;
  - les alertes dans l'application restent inchangées.
- **Recherche tolérante** : la recherche de cartes tolère les fautes de frappe courantes (une ou deux lettres selon la longueur du mot) et classe les résultats par pertinence (nom exact, début de nom, nom, puis texte de règles) quand une recherche est saisie.
- **Écritures hors ligne** :
  - les ajouts, modifications et suppressions de lignes de collection faits hors ligne sont appliqués tout de suite à l'écran, mis en file sur l'appareil, puis envoyés dans l'ordre au retour du réseau ;
  - un indicateur montre les modifications en attente et les éventuels échecs.
- **États de chargement** : chaque écran du compte (tableau de bord, investissement, decks, souhaits, réglages) affiche un squelette tant que ses données ne sont pas là, au lieu d'un écran vide ou faux. Ce point reprend la tâche 3.2 encore ouverte de `instant-app-session-resume`.
- **Accessibilité des fenêtres** :
  - toutes les fenêtres modales et feuilles (fiche carte, ajout rapide, filtres, confirmations, tutoriel) gardent le focus à l'intérieur, se ferment avec Échap et rendent le focus à l'élément qui les a ouvertes ;
  - la sélection multiple de l'explorateur devient utilisable au clavier.
- **Découpage des gros composants** (sans changement visible) : `DecksScreen`, `Dashboard`, `CardModal`, `InvestmentScreen` et `CardsExplorer` sont découpés en modules. Les panneaux secondaires sont chargés à la demande.

**Hors périmètre** :
- notifications par e-mail ;
- alertes sur la valeur de la collection (« ma carte a pris 20 % ») ;
- choix du tirage dans un deck (les decks restent fondés sur la carte, pas le tirage) ;
- synchronisation hors ligne des decks et des souhaits (seule la collection est concernée) ;
- indexation des decks partagés ;
- recherche côté serveur.

## Capabilities

### New Capabilities
- `decks/completion` : ce qui manque à la collection pour monter un deck, son coût, et l'ajout des manquantes à la liste de souhaits.
- `decks/sharing` : lien public en lecture seule vers un deck, sa gestion par le propriétaire et la page publique.
- `wishlist/price-alerts` : déclenchement des alertes de prix et leur remise à l'utilisateur, dans l'application et par notification push.
- `catalog/card-search` : correspondance et classement de la recherche de cartes dans l'application.
- `collection/offline-sync` : modifications de collection hors ligne, file d'attente et synchronisation.
- `site/loading-states` : affichage des écrans du compte pendant le chargement de leurs données.
- `site/dialog-accessibility` : comportement clavier et focus des fenêtres modales, des feuilles et de la sélection multiple.

### Modified Capabilities
<!-- Aucune : aucune spec existante ne couvre ces comportements (catalog/public-cards concerne le catalogue public, pas la recherche de l'application). -->

## Impact

- **Base de données** : deux nouveaux modèles.
  - `DeckShare` : jeton, un par deck, supprimé en cascade avec le deck.
  - `PushSubscription` : endpoint, clés et langue, liée à `User`, supprimée en cascade.
- **API** :
  - `/api/decks/[id]/share` (GET/POST/DELETE) ;
  - `/api/push/subscribe` (POST/DELETE) ;
  - ajout en lot dans la liste de souhaits (`/api/wishlist/bulk`).
- **Routes** : `/deck/[token]`, ajoutée à `src/i18n/routing.ts` et marquée `privateMetadata`.
- **Service worker** (`public/sw.js`) : gestion des événements `push` et `notificationclick`.
- **Cron** : `src/lib/price-import.ts` ; `evaluateWishlistAlerts` renvoie les alertes déclenchées pour l'envoi des notifications.
- **Dépendance** : `web-push`.
- **Variables d'environnement** : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **Client** :
  - `src/lib/logic.ts` (recherche) ;
  - `src/components/CollectionProvider.tsx` et un nouveau module de file hors ligne (`src/lib/offline-queue.ts`) ;
  - les écrans du compte ;
  - un composant ou hook commun pour les fenêtres ;
  - les composants découpés ;
  - les messages des 5 langues.
- **Tests** : unitaires (recherche, file hors ligne, complétion), base de données (partage de deck, abonnements push) et E2E (partage, hors ligne, focus des fenêtres).
