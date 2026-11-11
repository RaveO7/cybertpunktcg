---
name: changement-schema
description: Modifier le schéma Prisma de ce projet (ajout/modification de modèle, champ, relation, index) sans casser SQLite local, Postgres de prod, les cascades ni la CI. À utiliser dès qu'une tâche touche prisma/schema.prisma.
effort: high
---

0. **Worktree** (`.git` est un fichier) sans `node_modules` à lui : lance `npm ci` dans le worktree avant tout, pour que le client généré reste local et n'écrase pas celui du projet principal (un hook bloque la génération sinon).
1. **Serveur de dev** : arrête tout `next dev` en cours de cette copie (le moteur Prisma reste verrouillé sous Windows), sinon `generate` échoue avec EPERM.
2. **Modifier `prisma/schema.prisma`** (il reste en `provider = "postgresql"`) :
   - relation vers `User` : `onDelete: Cascade` pour que la suppression d'un compte emporte tout (règle des tests et suppression de compte) ;
   - relation vers le catalogue (`Card`, `Printing`, `Set`, `Condition`) : garder la règle des modèles voisins (`Restrict` ou `Cascade`) ;
   - nouveau champ obligatoire sur une table existante : une valeur par défaut, sinon `db push` refuse en prod ;
   - pas de type ou d'option propre à Postgres que SQLite ne supporte pas (enums natifs, `@db.*`), sauf vérification des deux côtés.
3. **Appliquer en local** : `node scripts/prisma.mjs generate` puis `node scripts/prisma.mjs db push --skip-generate`.
4. **Code** : types, requêtes, `src/lib/api-schemas.ts`, et les endroits qui listent les tables (`scripts/sql-dump.ts`, `scripts/sync-local-to-prod.ts`, `scripts/export-local-to-postgres.ts`, `scripts/export-test-fixtures.ts`, `tests/fixtures/seed-ci.ts`) si la table doit y figurer.
5. **Vérifier** : typecheck, lint, `npm run test:unit`, `npm run test:db` ; suppression de compte : `npx vitest run tests/db/account-delete.test.ts`.
6. **Prod** : rien à lancer à la main. Le build de production Vercel applique `db push` (`scripts/vercel-db-push.mjs`) et refuse toute perte de données. Si le changement supprime ou renomme une colonne avec des données, préviens-moi avant de commiter : il faut une migration en deux temps.
