# Design

## Context

Mesure faite sur un build de production local du 21/11, avec les source maps du build. Tailles non compressées ; le chunk de polyfills `noModule` est exclu car les navigateurs récents ne le téléchargent pas.

| Page | JS chargé | dont React + Next |
|---|---|---|
| Fiche carte | ~600 Ko (186 Ko gzip) | ~430 Ko |
| Collection | ~745 Ko (~230 Ko gzip) | ~430 Ko |
| Decks | ~720 Ko (~225 Ko gzip) | ~430 Ko |

Parts du projet chargées sur toutes les pages :
- `intl-messageformat` 25 Ko, next-intl et use-intl 20 Ko ;
- `Header` 14 Ko, `CollectionProvider` 9 Ko ;
- `i18n/match` et `routing` 11 Ko, `offline-queue` 6 Ko ;
- `push-client`, `WishlistProvider`, `Footer`.

Collection, en plus :
- `logic.ts` 22 Ko, `CardsExplorer` 18 Ko, `FilterPanel` 13 Ko, `@tanstack/virtual-core` 23 Ko ;
- importés statiquement par `CardsExplorer` : `CardModal` et ses sous-composants (~30 Ko : `AddCopyForm`, `CollectionLines`, `CardDetails`, `PrintingsStrip`, `ModalHeader`), `QuickAddSheet` 6 Ko et `WishlistPanel` 3 Ko.

Decks, en plus : `DeckEditor` 14 Ko et ses panneaux (`ShortfallPanel`, `ShareDeckPanel`, `TransferPanels`, `CardPreview`), importés statiquement par `DecksScreen` même sur la liste.

Lighthouse démarre avec un stockage vide. Les requêtes de démarrage (`BOOT_REQUESTS_SCRIPT`) ne partent donc pas, car elles exigent la session mémorisée dans `localStorage`. Le catalogue (80 Ko) et la collection ne partent qu'après l'hydratation, vers 560 ms sur la trace. Le cookie de session `cptcg_session` est `httpOnly` : le script du `<head>` ne peut pas le lire.

## Goals / Non-Goals

**Goals:**
- Retirer du premier chargement le JS du projet qui n'est pas nécessaire au premier affichage. Cible : −15 à −20 % du JS chargé sur les trois pages.
- Fiche carte mobile ≥ 92 en prod (médiane de 5 passages). Collection et decks en progrès mesurable.

**Non-Goals:**
- Changer de framework ou de version de React ou de Next, ou retirer des fonctions du site.
- Rendre côté serveur la grille de la collection, qui reste privée et hors du rendu serveur.
- Polices (prompt 2, chantier séparé) et catalogue public `/fr/cartes`.

## Decisions

1. **Précompilation des messages par next-intl : écartée après essai**
   - Dans next-intl 4.14.9, l'option remplace `use-intl/format-message` par la version `format-only` pour le client **et** le serveur.
   - Cette version refuse `t.raw` et ne garde pas les valeurs en tableau. Le projet compte 140 contenus structurés de ce type (`landing`, `legal`, `rules`), lus avec `t.raw` côté serveur.
   - Les migrer sort du périmètre pour un gain d'environ 25 Ko non compressés (~8 Ko gzip). Le moteur reste dans le JS client.

2. **Imports différés avec `next/dynamic`, chargés seulement quand l'élément est affiché**
   - Composants concernés :
     - `CardModal`, `QuickAddSheet` et `WishlistPanel` dans la collection ;
     - `DeckEditor` et les panneaux dans les decks ;
     - les panneaux d'erreur de synchronisation et le choix de langue du `Header`, s'ils pèsent assez.
   - Modèle existant : `AuthScreen` dans `RequireUser`.
   - Pour l'état de chargement, on réutilise le squelette ou la fenêtre vide existante.
   - Une carte ouverte par l'URL se charge aussitôt : le rendu conditionnel déclenche le chargement.
   - Écarté : précharger ces morceaux au survol (hors périmètre, à voir si l'ouverture paraît lente).

3. **Allègement du code commun, piloté par la mesure**
   - Pour chaque module de plus de 3 Ko du code commun (`CollectionProvider`, `offline-queue`, `push-client`, `i18n/match`), vérifier s'il sert au premier affichage d'un visiteur.
   - Si ce n'est pas le cas, l'importer à l'usage (import dynamique dans l'action concernée).
   - Pas de refonte des fournisseurs de contexte.

4. **Cookie indicateur de session posé par le proxy**
   - Le proxy voit déjà `cptcg_session` sur chaque requête (`SESSION_PAGE_HEADER`). Il pose `cptcg_signed=1`, non `httpOnly`, `SameSite=Lax`, avec le même chemin. Il le supprime quand la session est absente, en ne touchant au cookie que si son état change.
   - `BOOT_REQUESTS_SCRIPT` lance les requêtes si la session est mémorisée **ou** si `document.cookie` contient l'indicateur.
   - Toutes les façons de se connecter et de se déconnecter sont couvertes sans toucher aux routes d'auth : formulaire, OAuth, expiration.
   - Écarté : poser l'indicateur dans les routes de connexion. Plusieurs chemins seraient à couvrir, et une expiration côté serveur le laisserait en place.
   - Écarté : rendre la page dynamique selon le cookie. La mise en page commune deviendrait dynamique, ce qui casse l'accueil pré-généré et le bfcache.
   - L'indicateur ne donne aucun droit : l'API vérifie toujours la vraie session. S'il reste après expiration, `/api/collection` répond 401 et l'écran de connexion s'affiche, comme aujourd'hui.

## Risks / Trade-offs

- [Précompilation incompatible avec le chargement par blocs ou les contenus structurés] → essai isolé en premier, comparaison du rendu des 5 langues par les e2e et les captures ; abandon de ce seul point si nécessaire.
- [Première ouverture d'une fenêtre plus lente sur réseau lent] → état de chargement visible ; les morceaux sont petits (≤ 30 Ko) et mis en cache par le service worker.
- [Gain mesuré inférieur à l'estimation, notes Lighthouse bruitées] → mesure prod avant/après, 5 passages, à la suite ; on dit franchement si le gain n'est pas mesurable.
- [Cookie supplémentaire envoyé à chaque requête] → quelques octets, sans donnée personnelle.

## Migration Plan

- Aucune migration de données.
- Livraison en circuit `complet` (branche `feat/`) : test de la preview en lecture seule, puis production.
- Retour arrière : revert du commit. Le cookie indicateur reste sans effet, car le script ne fait que lancer plus tôt des requêtes que l'app aurait faites de toute façon.
