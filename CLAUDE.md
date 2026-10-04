@AGENTS.md

# Règles du projet

## Tests : ne jamais polluer la base

Tout test, script de vérification ou essai manuel qui crée quelque chose en base (compte, carte en collection, session, partage, prix, snapshot…) doit **tout supprimer à la fin, même en cas d'échec**.

- Nettoyer dans un `finally` (ou le `.finally()` de `main()`), pas seulement en fin de chemin heureux.
- Mémoriser les ids créés et les supprimer explicitement ; supprimer un `User` suffit pour ses données liées (cascade).
- Ne jamais supprimer ni modifier des données qui n'ont pas été créées par le test. Si le test doit altérer des données existantes (prix, catalogue…), travailler sur une **copie** de `data/collection.db` (voir `scripts/verify-history-cache.ts`).
- Les comptes de test utilisent des e-mails en `@example.com`.
- Ne jamais lancer de test contre la base de production (Postgres sur Vercel) : en local `DATABASE_URL` doit pointer vers SQLite (`file:...`).

## Base de données

- Local : SQLite (`data/collection.db`). Production : Postgres (Prisma Postgres sur Vercel).
- `prisma/schema.prisma` reste en `postgresql` ; toujours lancer la CLI Prisma via `node scripts/prisma.mjs <commande>`, qui choisit le schéma selon `DATABASE_URL`.
