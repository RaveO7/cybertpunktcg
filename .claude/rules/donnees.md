---
paths:
  - "src/lib/**"
  - "src/app/api/**"
  - "src/app/og/**"
---
# Données, sécurité et cache

## Accès à la base
- Requêtes Prisma uniquement dans `src/lib/**` (via `src/lib/prisma.ts`) : une route ou un composant appelle une fonction de `lib`, jamais `prisma.xxx` (le lint le bloque). Passer le client à une fonction de `lib` reste permis (`loadTournament(prisma, id)`).
- Donnée d'un utilisateur : `userId` dans **chaque** `where`, y compris pour modifier et supprimer.
  - Bon : `updateMany({ where: { id, userId }, data })` puis vérifier `count`, ou `findFirst({ where: { id, userId } })` dans la même transaction que l'écriture.
  - Mauvais : vérifier l'appartenance, puis `update({ where: { id } })` — la sécurité dépend alors de l'ordre des appels.
- Le `userId` vient de la session côté serveur (`requireUser`, `sessionRequired`), jamais du corps de la requête ni des paramètres.
- `select` explicite (seulement les champs utiles) ; ne jamais renvoyer une ligne Prisma brute au client.
- Pas de requête dans une boucle (N+1) : `findMany({ where: { id: { in: ids } } })` ou `include`.
- Plusieurs écritures qui doivent réussir ensemble : `prisma.$transaction`, courte, sans appel réseau dedans.
- Schéma : skill `changement-schema` (SQLite local et Postgres prod doivent rester compatibles).
- Nouvelle garde d'accès : test dans `tests/db/security.test.ts` + mutation (skill `test-mutation`).

## Validation et erreurs
- Toute entrée (corps, query string, params, en-têtes, réponse d'une API externe) passe par un schéma Zod de `src/lib/api-schemas.ts` (ou du domaine). Query string : `z.coerce.*`.
- Un schéma est défini une fois ; le type en dérive (`z.infer`), pas d'interface parallèle.
- Erreur serveur inattendue : `reportError(source, error, contexte)` de `src/lib/monitoring.ts`, puis réponse via `errorResponse`.

## Cache serveur
- Le mode « Cache Components » (`use cache`) n'est **pas** activé : ne pas l'utiliser.
- Donnée partagée par tous (catalogue, prix) : `unstable_cache` avec un tag constant exporté (modèle : `CATALOG_CACHE_TAG` dans `src/lib/catalog.ts`) et un `revalidate`.
- Jamais de cache partagé pour une donnée propre à un utilisateur.
- Après une écriture qui change une donnée en cache : `revalidateTag(TAG, "max")` (la forme à un seul argument est dépréciée). Nouvelle invalidation : la couvrir par `scripts/mutate-cache-checks.ts`.

## Variables d'environnement
- Secrets lus seulement côté serveur. `NEXT_PUBLIC_*` est copié dans le JavaScript du navigateur au build : jamais de secret ni d'URL de base.
- Nouvelle variable : l'ajouter à `.env.example` et sur Vercel (skill `vercel`).
