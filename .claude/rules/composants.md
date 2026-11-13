---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
---
# Composants React

## Serveur ou client
- Composant serveur par défaut. `"use client"` seulement sur la plus petite brique qui a besoin d'état, d'événements, d'effets ou d'API du navigateur.
- Contenu serveur dans un composant client : le passer en `children` / props, ne pas l'importer dans le fichier client.
- Props qui traversent la frontière : objets simples et minimaux (jamais une ligne Prisma).

## Données et appels à l'API
- Lecture des données de l'utilisateur : par les providers existants (`useCollection`, `usePreferences`, `useWishlist`…) et le cache `src/components/data-cache.ts` (`useCachedJson(url, "decksSchema")`, `fetchCached`), seul cache client autorisé.
- Tout appel à `/api` : `api()` de `src/lib/client/api.ts` (hors ligne, 401, message du serveur, `ApiError` avec `kind`, `status`, `details`). Pas de `fetch` direct ni de nouveau wrapper.
- Réponse lue côté client : `schema` = **nom** d'un schéma de `src/lib/api-responses.ts` (`zod/mini`), pas de `as T`. Ne jamais importer une valeur de ce fichier dans du code client (`import type` seulement) : Zod ne doit pas entrer dans le premier chargement des pages, `api()` charge les schémas à part. Type d'une réponse : `Parsed<"xSchema">`. Nouveau schéma dont le type reste écrit côté serveur : concordance dans `tests/unit/api-responses.test.ts`.
- Message affiché : `useApiErrorMessage()` (ou `useTranslatedRequest()` dans un provider dont les écrans lisent `error.message`) ; écrans de tournoi : `useTournamentErrorMessage()`.
- Une erreur de requête s'affiche à l'utilisateur (message traduit) ou remonte ; jamais `.catch(() => {})`.

## Hooks et effets
- Pas d'effet pour ce qui se calcule pendant le rendu (valeur dérivée), pour réagir à un clic (gestionnaire d'événement), ni pour copier une prop dans un état (utiliser `key` pour réinitialiser).
- Effet réservé à la synchronisation avec l'extérieur (abonnement, API du navigateur, minuterie), avec nettoyage.
- Dépendances complètes : pas de `eslint-disable react-hooks/*`. Partie « événement » d'un effet : `useEffectEvent`.
- Le React Compiler n'est pas activé : `useMemo` / `useCallback` seulement pour un calcul coûteux mesuré ou une identité stable requise (dépendance d'effet, prop d'un composant mémoïsé).
- Formulaire avec état d'envoi : `useActionState` / `useFormStatus` plutôt qu'un `useState` de « loading » fait main.

## Taille et découpage
- Un composant = une responsabilité. Au-delà de ~250 lignes ou ~10 hooks : extraire un hook (`use-xxx.ts`) ou des sous-composants dans le dossier de la fonctionnalité.
- Motif d'interface répété 3 fois : en faire un composant. Fenêtre modale : `src/components/use-modal.ts` existant, pas un nouvel overlay.

## Style et accessibilité
- Tailwind en priorité ; couleurs et espacements par les variables du thème (`globals.css`), pas de valeurs arbitraires (`bg-[#…]`, `w-[37px]`) sans commentaire. Pas de nouvelle classe dans `globals.css` si une classe utilitaire suffit.
- Élément cliquable = `<button>` ou `<a>`, jamais `onClick` sur une `div`. Toute image a un `alt` (vide si décorative). Champ de formulaire avec `<label>`. Navigation au clavier et focus visible.
- Textes : règle `i18n.md`.

## Vérifier
- Interface modifiée : captures desktop et mobile (commande du CLAUDE.md), et les regarder.
