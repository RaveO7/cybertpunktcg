---
paths:
  - "src/app/api/**"
  - "src/lib/api-*.ts"
  - "src/lib/app-error.ts"
---
# Routes API

- Corps JSON : schéma Zod dans `src/lib/api-schemas.ts`, lu avec `const parsed = await readJsonBody(request, schema); if (!parsed.ok) return parsed.response;`.
- Erreurs : `apiError(request, "bloc.cle", status)` et `errorResponse(request, "source", error)` de `src/lib/api-response.ts` ; dans la logique métier, `fail("bloc.cle", status)` de `src/lib/app-error.ts`. Messages traduits dans le bloc `api` des 5 langues, jamais de texte en dur.
- Session absente : `sessionRequired(request)`. Toute requête Prisma sur des données d'utilisateur filtre par `userId` (lecture, modification et suppression).
- Connexion, inscription et routes coûteuses : limiteur de `src/lib/rate-limit.ts`.
- `export const dynamic = "force-dynamic"` pour une route qui lit la session ou la base.
- Tests dans `tests/db/` (`routes.test.ts`, `security.test.ts` pour l'accès aux données d'autrui). Garde d'accès ajoutée : ajouter sa mutation (skill `test-mutation`).
