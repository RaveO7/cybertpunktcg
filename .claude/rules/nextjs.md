---
paths:
  - "src/app/**"
  - "src/proxy.ts"
  - "next.config.ts"
---
# Next.js 16 (App Router)

- Next 16.3 diffère des versions connues : avant d'utiliser une API, lire sa page dans `node_modules/next/dist/docs/` (`01-app/03-api-reference/…`).
- `page.tsx` reste fin et serveur : il compose des composants et charge les données serveur ; la logique va dans `src/lib`.
- Données indépendantes chargées ensemble (`Promise.all`), pas `await a(); await b();`. Partie lente : `<Suspense>` ou `loading.tsx`.
- Route API : règle `api.md`. Les Server Actions ne sont pas utilisées dans ce projet (application hors-ligne : les modifications passent par `/api` et la file de synchro du client).
- `proxy.ts` : vérifications légères seulement (cookie, redirection, en-têtes), aucune requête en base, jamais seule barrière d'autorisation.
- Ressource absente : `notFound()`. Ne jamais entourer `redirect()` / `notFound()` d'un `try/catch` (ce sont des erreurs de contrôle) ; sinon `unstable_rethrow(error)` en tête du `catch`.
- `error.tsx` : composant client, utiliser la prop `retry()` (stable depuis 16.3), pas `reset()` ; ne pas afficher `error.message` (générique en production).
- `revalidateTag(tag, "max")` avec deux arguments. Pas de `use cache` (non activé). Pas de `runtime = "edge"`.
- Images : `next/image` avec `width`/`height` (ou `fill` + `sizes`). Exception existante : images de cartes servies par `src/lib/card-image.ts` — garder leur composant `CardImage`.
- Composant lourd et uniquement client (carte Leaflet, graphique) : `next/dynamic` depuis un composant client.
- Métadonnées et SEO : fonctions de `src/lib/seo/`, pour les 5 langues.
