---
paths:
  - "tests/**"
  - "scripts/**"
  - "prisma/**"
---
# Tests et scripts

- Vitest : `tests/unit/**` (projet `unit`, sans base) et `tests/db/**` (projet `db`, SQLite, fichiers en série, garde `tests/setup/local-db-only.ts`).
- Test qui modifie des données existantes : `openDatabaseCopy(prefix)` de `tests/helpers/db-copy.ts` dans `beforeAll`, **avant** tout import de `src/lib/prisma`, et `cleanup()` dans `afterAll`.
- Comptes de test : e-mail `…@example.com`, supprimés dans un `finally` / `afterAll` (la suppression du `User` emporte ses données).
- e2e : partir de `tests/e2e/fixtures.ts` (`test`, `account`, `snap`, `settle`, `expectNoHorizontalScroll`) ; le compte est créé et supprimé par la fixture.
- Catalogue de la CI : `tests/fixtures/catalog.json`, régénéré par `npx tsx scripts/export-test-fixtures.ts` après un import important (nouvelle extension).
- Script qui écrit en base : `requireLocalDatabase()` (de `scripts/sql-dump.ts`) en tête, nettoyage dans `main().finally(...)`.
