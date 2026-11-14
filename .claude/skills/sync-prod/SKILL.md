---
name: sync-prod
description: Envoie la base locale (catalogue, prix, cartes de collection manquantes) vers la base Postgres de production, avec simulation préalable et confirmation.
disable-model-invocation: true
---

Script : `scripts/sync-local-to-prod.ts` (structure via `db push` ; catalogue ajouté/mis à jour ; prix remplacés ; collections : ajouts seulement, rien de supprimé côté prod).

1. **Avant** : arbre git propre ou changements commités ; `DATABASE_URL` local en `file:` (le script le vérifie aussi).
2. **Simulation** : `npm run db:sync-prod -- --dry-run` → génère `data/sync-prod.sql` sans rien envoyer. Résume-moi les volumes par table (lignes ajoutées / mises à jour / remplacées) et tout ce qui semble anormal (table vide, volume inattendu).
3. **Confirmation** (la seule) : attends mon « ok » explicite après le résumé.
4. **Envoi** : `npm run db:sync-prod`.
5. **Après** : vérifie que le site de production répond (`vercel` ou une requête sur l'URL publique) et donne-moi le résultat en une ligne.

Ne jamais utiliser `scripts/export-local-to-postgres.ts` pour une mise à jour : il vide les tables de prod (TRUNCATE) avant de tout recopier.
