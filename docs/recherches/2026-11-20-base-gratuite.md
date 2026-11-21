# Remplacer Prisma Postgres (gratuit) par une autre base gratuite

Date : 2026-11-20. Contexte : le plan gratuit Prisma Postgres (200 000 opérations/mois) est épuisé, les requêtes
de la prod sont bloquées jusqu'au 1er décembre (ou passage au plan Starter, 10 $/mois).

## Ce que le code impose (vérifié dans le dépôt)

- Schéma portable : pas de SQL brut dans `src/`, pas d'enum, de `@db.*`, de tableau scalaire ni de `mode: "insensitive"` ;
  JSON stockés en `String`. N'importe quel Postgres convient, sans changer de code.
- Deux URL : `DATABASE_URL_POOLED` pour le site (`src/lib/prisma.ts`), `DATABASE_URL` directe pour le `db push` du build.
- Écritures régulières : cron quotidien `/api/cron/import-prices` (05:00).

## Options (gratuit)

| Option | Limite qui compte | Veille / blocage | Sauvegardes | Prisma 6 + Vercel | Effort |
|---|---|---|---|---|---|
| **Supabase Free** | 500 Mo/projet, 5 Go egress, **pas de plafond de requêtes** | pause après 7 j sans activité (le cron l'évite) | aucune (export manuel) | pooler 6543 `pgbouncer=true` + directe 5432, documenté | changer 2 variables |
| **Neon Free** | 100 CU-heures/mois, 1 Go | veille après 5 min (réveil à froid à chaque visite espacée) ; quota épuisé = suspendu jusqu'au mois suivant | restauration 6 h | `-pooler` + `DATABASE_URL_UNPOOLED`, documenté ; intégration Vercel | changer 2 variables |
| Turso Free (SQLite) | 500 M lignes lues, 10 M écrites | bloqué au-delà | 1 jour | adaptateur libSQL en **préversion**, pas de `db push` distant | changer de provider : lourd |
| CockroachDB Basic | 50 M RU, 10 Gio | facturé au-delà | quotidiennes | dialecte à part, non vérifié | moyen |
| Aiven Free | 1 Go, 20 connexions | veille si inactif (réveil manuel) | oui | Postgres standard | changer 2 variables |
| Render Free | — | **expire et supprime après 30 j** | non | — | exclu |

## Recommandation

Supabase Free : aucun plafond de requêtes (la cause du blocage actuel), base toujours éveillée tant que le cron
tourne chaque jour (pas de réveil à froid, contrairement à Neon), configuration Prisma identique à l'actuelle
(pooler + directe). Neon reste un bon second choix (intégration Vercel en un clic) si le réveil à froid ne gêne pas.

**Décision** : Supabase Free, migré le 2026-11-21 (projet en eu-west-1). Données copiées table par table
pendant l'accès de 24 h, nombres de lignes vérifiés sur les 35 tables ; `DATABASE_URL` (pooler session 5432)
et `DATABASE_URL_POOLED` (pooler transaction 6543) remplacées sur Vercel en Production et Preview.

## Risques et points non confirmés

- Aucune sauvegarde sur Supabase Free : prévoir un export régulier (`supabase db dump` ou script).
- Région UE (Paris/Francfort) et nombre de connexions du pooler Free non confirmés sur les pages lues.
- Migration : l'export depuis Prisma Postgres passe par l'accès de 24 h, **utilisable une seule fois** ;
  `pg_dump` n'est pas installé sur la machine. Tout préparer avant de l'activer.

## Sources

- Supabase : https://supabase.com/pricing · https://supabase.com/docs/guides/platform/free-project-pausing · https://supabase.com/docs/guides/database/prisma
- Neon : https://neon.com/docs/introduction/limits (2026-11-12) · https://neon.com/docs/guides/prisma
- Turso : https://turso.tech/pricing · https://www.prisma.io/docs/orm/v6/overview/databases/turso
- Autres : https://docs.cockroachlabs.com/docs/cockroachcloud/costs · https://aiven.io/docs/products/postgresql/concepts/pg-free-tier · https://render.com/docs/free
- Prisma Postgres : https://www.prisma.io/docs/postgres/faq

## Suite : région des fonctions (2026-11-21)

Après la migration, `/api/collection` répondait en ~390 ms au lieu de ~100 ms (mesure navigateur, même compte, déploiements avant/après le changement de `DATABASE_URL`) : les fonctions tournaient à Francfort (`fra1`) et la base est en Irlande (eu-west-1), chaque requête SQL payait l'aller-retour entre les deux. LCP desktop de la collection 0,60 → 0,93 s, note Lighthouse 98 → 85. Fonctions déplacées à Dublin (`dub1` dans `vercel.json`), à côté de la base.
